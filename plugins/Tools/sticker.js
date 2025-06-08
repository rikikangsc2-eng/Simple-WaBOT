const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    command: ['s','sticker'],
    description: 'Membuat stiker dari gambar/video.',
    run: async (sock, message, args) =>  {
        let mediaSource = null;
        const quotedMessage = message.msg?.contextInfo?.quotedMessage;

        if (quotedMessage && /imageMessage|videoMessage/.test(Object.keys(quotedMessage)[0])) {
            mediaSource = { message: quotedMessage };
        } else if (/imageMessage|videoMessage/.test(message.type)) {
            mediaSource = message;
        } else {
            return message.reply('Silakan reply gambar/video, atau kirim gambar/video dengan caption `.s`');
        }

        try {
            await message.reply('Sedang membuat stiker...');
            const buffer = await downloadMediaMessage(mediaSource, 'buffer', {});
            await message.sticker(buffer);
        } catch (e) {
            console.error(e);
            await message.reply(`Gagal membuat stiker. Pastikan media yang dikirim valid.\nError: ${e.message}`);
        }
    }
};