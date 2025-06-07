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
            rl.close();
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

const PORT = process.env.PORT || 7860;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot WhatsApp Aktif\n');
});

server.listen(PORT, () => {
    console.log(`Server HTTP berjalan di port ${PORT}`);
});

connectToWhatsApp().catch(console.error);