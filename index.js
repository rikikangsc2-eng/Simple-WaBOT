const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const http = require('http');
const chalk = require('chalk');
const fs = require('fs');
const handler = require('./handler');
const config = require('./config');
const { getBuffer } = require('./lib/functions');
const db = require('./lib/database');
const logger = require('./lib/logger');
const { loadPlugins } = require('./lib/pluginManager');
const { setConnectionStatus, processQueue } = require('./lib/connectionManager');

const sessionPath = path.join(__dirname, 'session');

let priceUpdateInterval = null;

function updateMarketPrices() {
    let market = db.get('market');
    const commodities = ['emas', 'iron', 'bara'];
    
    commodities.forEach(item => {
        const basePrices = { emas: 75000, iron: 25000, bara: 15000 };
        const fluctuations = { emas: 500, iron: 150, bara: 100 };
        const minPrices = { emas: 5000, iron: 1000, bara: 500 };
        
        const oldPrice = market[`${item}_price`] || basePrices[item];
        market[`last_${item}_price`] = oldPrice;
        
        const fluctuation = Math.floor(Math.random() * (2 * fluctuations[item] + 1)) - fluctuations[item];
        let newPrice = oldPrice + fluctuation;
        
        if (newPrice < minPrices[item]) newPrice = minPrices[item];
        
        market[`${item}_price`] = newPrice;
    });

    db.save('market', market);
    logger.info('[MARKET UPDATE] Harga pasar berhasil diperbarui.');
}

async function handleGroupUpdate(sock, event) {
    const { id, participants, action } = event;
    if (action !== 'add') return;
    
    const groupSettings = db.get('groupSettings');
    const groupSetting = groupSettings[id];
    if (!groupSetting || !groupSetting.isWelcomeEnabled) return;
    
    const groupMeta = await sock.groupMetadata(id);
    const groupName = groupMeta.subject;

    for (const jid of participants) {
        const welcomeText = groupSetting.welcomeMessage
            .replace(/\$group/g, groupName)
            .replace(/@user/g, `@${jid.split('@')[0]}`);
            
        let userThumb;
        try {
            const ppUrl = await sock.profilePictureUrl(jid, 'image');
            userThumb = await getBuffer(ppUrl);
        } catch (e) {
            userThumb = null;
        }

        const messageOptions = { 
            text: welcomeText, 
            contextInfo: { 
                mentionedJid: [jid],
                externalAdReply: userThumb ? {
                    title: config.botName,
                    body: 'Selamat Datang!',
                    thumbnail: userThumb,
                    sourceUrl: `https://wa.me/${config.ownerNumber}`,
                    mediaType: 1
                } : null
            } 
        };
        
        await sock.sendMessage(id, messageOptions);
    }
}

function formatUptime(seconds) {
    function pad(s) { return (s < 10 ? '0' : '') + s; }
    const hours = Math.floor(seconds / (3600));
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    return `${pad(hours)}h ${pad(minutes)}m ${pad(secs)}s`;
}

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 5000;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false, 
        browser: Browsers.ubuntu('Chrome'), 
        logger: pino({ level: 'silent' }) 
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            reconnectAttempts = 0;
            setConnectionStatus(true);
            console.log(chalk.green('\nKoneksi WhatsApp berhasil. Bot siap digunakan!'));
            logger.info(`Terhubung sebagai ${sock.user.name || config.botName}`);
            
            if (priceUpdateInterval) clearInterval(priceUpdateInterval);
            updateMarketPrices();
            priceUpdateInterval = setInterval(updateMarketPrices, 5 * 60 * 1000);
            
            processQueue(sock);
        } else if (connection === 'close') {
            setConnectionStatus(false);
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            logger.warn(`Koneksi terputus (Kode: ${statusCode}), mencoba menyambungkan kembali: ${shouldReconnect}`);
            
            if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
                logger.info(`Mencoba koneksi ulang dalam ${delay / 1000} detik (Percobaan ke-${reconnectAttempts})...`);
                setTimeout(connectToWhatsApp, delay);
            } else {
                 console.log(chalk.red('Koneksi terputus permanen atau gagal setelah beberapa kali percobaan. Hapus folder "session" dan mulai ulang.'));
                 logger.error(`Gagal terhubung setelah ${reconnectAttempts} kali percobaan.`);
                 if (fs.existsSync(sessionPath)) {
                     fs.rmSync(sessionPath, { recursive: true, force: true });
                 }
                 process.exit(1);
            }
        } else if (connection === 'connecting') {
            logger.info('Menghubungkan ke WhatsApp...');
        }
    });
    
    if (!sock.authState.creds.registered && config.botNumber) {
        console.log(chalk.yellow(`\nSesi tidak ditemukan. Meminta Kode Pairing untuk nomor ${config.botNumber}...`));
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(config.botNumber);
                console.log(chalk.green(`\nKode Pairing Anda: ${chalk.bold(code)}\n`));
                console.log(chalk.gray('Silakan masukkan kode ini di perangkat WhatsApp Anda (Opsi -> Perangkat Tertaut -> Tautkan perangkat -> Tautkan dengan nomor telepon).'));
            } catch (error) {
                logger.error('Gagal meminta pairing code:', error);
                console.log(chalk.red('\nGagal mendapatkan Kode Pairing. Pastikan nomor bot benar dan coba lagi.'));
                connectToWhatsApp();
            }
        }, 3000);
    }
    
    sock.ev.on('messages.upsert', async (mek) => {
        try {
            const m = mek.messages[0];
            if (!m.message || m.key.fromMe || m.key.remoteJid === 'status@broadcast') return;
            await handler(sock, m, {});
        } catch (e) {
            logger.error(e, 'Error di messages.upsert');
        }
    });

    sock.ev.on('group-participants.update', async (event) => {
        await handleGroupUpdate(sock, event);
    });
    
    return sock;
}

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        status: 'online', 
        uptime: formatUptime(process.uptime()), 
        message: `${config.botName} is running!` 
    }));
}).listen(PORT, () => logger.info(`Server status berjalan di port ${PORT}`));

console.clear();
console.log(chalk.bold.cyan(config.botName));
console.log(chalk.gray(`by ${config.ownerName}\n`));
console.log(chalk.yellow('Menunggu koneksi WhatsApp...'));

loadPlugins();
connectToWhatsApp().catch(err => logger.error(err, "Gagal terhubung ke WhatsApp:"));