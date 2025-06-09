const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const http = require('http');
const fs = require('fs');
const chalk = require('chalk');
const handler = require('./handler');
const config = require('./config');
const { getBuffer } = require('./lib/functions');

const sessionPath = path.join(__dirname, 'session');
const logger = pino({ level: 'silent' });

const minReconnectDelay = 10000;
const maxReconnectDelay = 30000;

function initializePlugins(sock) {
    const pluginsDir = path.join(__dirname, 'plugins');
    fs.readdirSync(pluginsDir).forEach(category => {
        const categoryDir = path.join(pluginsDir, category);
        if (fs.statSync(categoryDir).isDirectory()) {
            fs.readdirSync(categoryDir).forEach(file => {
                if (path.extname(file) === '.js') {
                    try {
                        const plugin = require(path.join(categoryDir, file));
                        if (typeof plugin.init === 'function') {
                            plugin.init(sock);
                        }
                    } catch (e) {
                        console.error(`Gagal menginisialisasi plugin ${file}:`, e);
                    }
                }
            });
        }
    });
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
                messageOptions.contextInfo = {
                    externalAdReply: {
                        title: config.botName,
                        body: 'Selamat Datang!',
                        thumbnail: userThumb,
                        sourceUrl: `https://wa.me/${config.ownerNumber}`,
                        mediaType: 1
                    }
                };
            }
            await sock.sendMessage(id, messageOptions);
        }
    } catch (e) {
        console.error('Gagal memproses event group update:', e);
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        logger,
    });
    
    initializePlugins(sock);
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'connecting') {
            console.log(chalk.yellow('Menghubungkan ke WhatsApp...'));
        } else if (connection === 'open') {
            console.log(chalk.green('Koneksi WhatsApp berhasil terbuka!'));
        } else if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect.error)?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
                console.log(chalk.red('Koneksi terputus, kredensial tidak valid. Hapus folder session dan mulai ulang.'));
                process.exit(1);
            }
            const reconnectDelay = Math.floor(Math.random() * (maxReconnectDelay - minReconnectDelay + 1)) + minReconnectDelay;
            console.log(chalk.yellow(`Koneksi terputus, mencoba menyambungkan kembali dalam ${reconnectDelay / 1000} detik...`));
            setTimeout(connectToWhatsApp, reconnectDelay);
        }
    });
    
    if (!sock.authState.creds.registered) {
        if (!config.botNumber) {
            console.log(chalk.red('Error: "botNumber" tidak diatur di config.js. Harap isi untuk mendapatkan pairing code.'));
            process.exit(1);
        }
        console.log(chalk.yellow(`Tidak ada sesi ditemukan. Meminta Pairing Code untuk nomor: ${config.botNumber}`));
        setTimeout(async () => {
            try {
                const pairingCode = await sock.requestPairingCode(config.botNumber);
                console.log(chalk.green(`Kode Pairing Anda: ${chalk.bold(pairingCode)}`));
            } catch (error) {
                console.error(chalk.red('Gagal meminta pairing code:'), error);
                connectToWhatsApp();
            }
        }, 3000);
    }
    
    sock.ev.on('messages.upsert', async (mek) => {
        try {
            const m = mek.messages[0];
            if (!m.message || m.key.fromMe || m.key.remoteJid === 'status@broadcast') return;
            await handler(sock, m);
        } catch (e) {
            console.error(e);
        }
    });
    
    sock.ev.on('group-participants.update', async (event) => {
        await handleGroupUpdate(sock, event);
    });
    
    return sock;
}

const PORT = process.env.PORT || 3000;
const redirectUrl = 'https://nirkyy-dev.hf.space';
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    res.writeHead(302, { 'Location': redirectUrl + req.url });
    res.end();
});

server.listen(PORT, () => {
    console.log(`Server HTTP redirect berjalan di port ${PORT}, mengarahkan ke ${redirectUrl}`);
});

connectToWhatsApp().catch(console.error);