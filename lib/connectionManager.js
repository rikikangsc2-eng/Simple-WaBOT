const logger = require('./logger');

let isConnected = false;
const messageQueue = [];

function setConnectionStatus(status) {
    isConnected = status;
    logger.info(`Status Koneksi WhatsApp diatur ke: ${status}`);
}

function isWhatsAppConnected() {
    return isConnected;
}

function addToQueue(job) {
    messageQueue.push(job);
    logger.info(`Pesan ditambahkan ke antrean. Total antrean: ${messageQueue.length}`);
}

async function processQueue(sock) {
    if (messageQueue.length === 0) {
        logger.info('Antrean pesan kosong, tidak ada yang diproses.');
        return;
    }

    logger.info(`Memproses ${messageQueue.length} pesan dari antrean...`);
    
    while (messageQueue.length > 0) {
        const { jid, content, options } = messageQueue.shift();
        try {
            await sock.sendMessage(jid, content, options);
            await new Promise(resolve => setTimeout(resolve, 500)); 
        } catch (e) {
            logger.error(e, `Gagal mengirim pesan dari antrean ke ${jid}`);
        }
    }
    
    logger.info('Semua pesan dalam antrean telah berhasil diproses.');
}

module.exports = {
    setConnectionStatus,
    isWhatsAppConnected,
    addToQueue,
    processQueue
};