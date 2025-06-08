const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const readline = require('readline');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { URL, URLSearchParams } = require('url');
const chalk = require('chalk');
const handler = require('./handler');
const config = require('./config');
const { getBuffer } = require('./lib/functions');

let sock = null;
let botStatus = 'starting';
let pairingCode = null;
let startTime = Date.now();
let isConnecting = false;

const logger = pino({ level: 'silent' });
const sessionPath = path.join(__dirname, 'session');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

function getCPUUsage(callback) {
    const startUsage = process.cpuUsage();
    const startTime = process.hrtime.bigint();
    setTimeout(() => {
        const endTime = process.hrtime.bigint();
        const endUsage = process.cpuUsage();
        const elapTime = endTime - startTime;
        const elapUsage = { user: endUsage.user - startUsage.user, system: endUsage.system - startUsage.system };
        const cpuPercent = ((elapUsage.user + elapUsage.system) / 1000 / Number(elapTime / 1000n)) * 100;
        callback(cpuPercent.toFixed(2));
    }, 1000);
}

async function handleGroupUpdate(sock, event) {
    const { id, participants, action } = event;
    if (action !== 'add') return;
    const dbPath = path.join(__dirname, 'database/groupSettings.json');
    if (!fs.existsSync(dbPath)) return;
    try {
        const settings = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const groupSetting = settings[id];
        if (!groupSetting || !groupSetting.isWelcomeEnabled) return;
        const groupMeta = await sock.groupMetadata(id);
        const groupName = groupMeta.subject;
        for (const jid of participants) {
            const welcomeText = groupSetting.welcomeMessage.replace(/\$group/g, groupName).replace(/@user/g, `@${jid.split('@')[0]}`);
            let userThumb;
            try {
                const ppUrl = await sock.profilePictureUrl(jid, 'image');
                userThumb = await getBuffer(ppUrl);
            } catch (e) {
                userThumb = null;
            }
            const messageOptions = { text: welcomeText, mentions: [jid] };
            if (userThumb) {
                messageOptions.contextInfo = { externalAdReply: { title: config.botName, body: 'Selamat Datang!', thumbnail: userThumb, sourceUrl: `https://wa.me/${config.ownerNumber}`, mediaType: 1 }};
            }
            await sock.sendMessage(id, messageOptions);
        }
    } catch (e) {
        console.error('Gagal memproses event group update:', e);
    }
}

async function connectToWhatsApp() {
    if (isConnecting) return;
    isConnecting = true;

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        logger,
        version: [2, 2413, 1],
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'connecting') {
            botStatus = 'connecting';
            console.log(chalk.yellow('Menghubungkan ke WhatsApp...'));
        } else if (connection === 'open') {
            botStatus = 'open';
            pairingCode = null;
            startTime = Date.now();
            isConnecting = false;
            console.log(chalk.green('Koneksi WhatsApp berhasil terbuka!'));
            if (rl) rl.close();
        } else if (connection === 'close') {
            isConnecting = false;
            const statusCode = new Boom(lastDisconnect.error)?.output?.statusCode;
            if (statusCode === DisconnectReason.badSession) {
                botStatus = 'needs_pairing';
                console.log(chalk.red('Sesi buruk atau tidak ditemukan. Silakan lakukan pairing.'));
                return;
            }
            if (statusCode === DisconnectReason.loggedOut) {
                console.log(chalk.red('Logout terdeteksi. Menghapus sesi lama...'));
                fs.rmSync(sessionPath, { recursive: true, force: true });
                process.exit(1);
            }
            botStatus = 'close';
            console.log(chalk.yellow('Koneksi terputus, mencoba menyambungkan kembali...'));
            setTimeout(connectToWhatsApp, 15000);
        }
    });

    sock.ev.on('messages.upsert', async (mek) => {
        try {
            const m = mek.messages[0];
            if (!m.message) return;
            await handler(sock, m);
        } catch (e) {
            console.error(e);
        }
    });

    sock.ev.on('group-participants.update', async (event) => {
        await handleGroupUpdate(sock, event);
    });

    if (!state.creds.registered) {
        botStatus = 'needs_pairing';
        if (process.stdin.isTTY) {
            console.log(chalk.yellow('Sesi tidak ditemukan.'));
            const phoneNumber = await question(chalk.cyan('Masukkan nomor WhatsApp Anda (contoh: 6281234567890): '));
            pairingCode = await sock.requestPairingCode(phoneNumber.trim());
            botStatus = 'pairing_code_generated';
            console.log(chalk.green(`Kode Pairing Anda: ${chalk.bold(pairingCode)}`));
        } else {
             console.log(chalk.yellow(`Sesi tidak ditemukan. Akses web UI di port ${PORT} untuk pairing.`));
        }
    }
}

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (reqUrl.pathname !== '/') { res.writeHead(302, { 'Location': 'https://github.com/Nir-Tzy' }); res.end(); return; }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            const params = new URLSearchParams(body);
            const phoneNumber = params.get('phone');
            if (phoneNumber && sock && botStatus !== 'open') {
                try {
                    pairingCode = await sock.requestPairingCode(phoneNumber.trim());
                    botStatus = 'pairing_code_generated';
                    res.end(`<h1>Kode Pairing: ${pairingCode}</h1><p>Masukkan kode ini di WhatsApp.</p><a href="/">Kembali</a>`);
                } catch (e) {
                    res.end(`<h1>Gagal: ${e.message}</h1><a href="/">Coba lagi</a>`);
                }
            } else {
                res.end('<h1>Nomor tidak valid atau bot sudah terhubung.</h1><a href="/">Kembali</a>');
            }
        });
        return;
    }

    if (botStatus === 'open') {
        getCPUUsage(cpu => {
            const uptime = Math.floor((Date.now() - startTime) / 1000);
            res.end(`<h2>Bot Aktif</h2><p>Status: Terhubung</p><p>Uptime: ${uptime} detik</p><p>CPU Usage: ${cpu}%</p>`);
        });
    } else if (botStatus === 'pairing_code_generated') {
        res.end(`<h1>Kode Pairing: ${pairingCode}</h1><p>Masukkan kode ini di WhatsApp.</p><a href="/">Refresh</a>`);
    } else if (botStatus === 'connecting' || botStatus === 'close') {
        res.end(`<h1>Bot sedang ${botStatus === 'connecting' ? 'Menyambungkan' : 'Menyambungkan Ulang'}...</h1><p>Silakan refresh.</p>`);
    } else if (botStatus === 'needs_pairing') {
        res.end(`<h1>Input Nomor untuk Pairing</h1><form method="POST" action="/"><input type="text" name="phone" placeholder="6281234567890" required><button type="submit">Minta Kode</button></form>`);
    } else {
        res.end('<h1>Bot memulai...</h1><p>Silakan refresh.</p>');
    }
});

server.listen(PORT, () => {
    console.log(`Server HTTP berjalan di port ${PORT}`);
    connectToWhatsApp().catch(console.error);
});