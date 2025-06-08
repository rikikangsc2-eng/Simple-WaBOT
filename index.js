const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const readline = require('readline');
const http = require('http');
const handler = require('./handler');

const sessionPath = path.join(__dirname, 'session');
const logger = pino({ level: 'silent' });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        logger,
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'connecting') {
            console.log('Menghubungkan ke WhatsApp...');
        } else if (connection === 'open') {
            console.log('Koneksi WhatsApp berhasil terbuka!');
            if (rl) rl.close();
        } else if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect.error)?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut) {
                console.log('Koneksi terputus, kredensial tidak valid. Harap hapus folder session dan mulai ulang.');
                process.exit(1);
            } else {
                console.log('Koneksi terputus, mencoba menyambungkan kembali...');
                setTimeout(connectToWhatsApp, 5000);
            }
        }
    });
    
    if (process.stdin.isTTY && !sock.authState.creds.registered) {
        console.log('Tidak ada sesi ditemukan, menggunakan Pairing Code.');
        const phoneNumber = await question('Masukkan nomor WhatsApp Anda (contoh: 6281234567890): ');
        const pairingCode = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`Kode Pairing Anda: ${pairingCode}`);
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
    
    res.writeHead(302, { 'Location': redirectUrl+req.url });
    res.end();
});

server.listen(PORT, () => {
    console.log(`Server HTTP redirect berjalan di port ${PORT}, mengarahkan ke ${redirectUrl}`);
});

connectToWhatsApp().catch(console.error);