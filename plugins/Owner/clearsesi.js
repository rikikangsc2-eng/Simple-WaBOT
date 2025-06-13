const fs = require('fs');
const path = require('path');
const config = require('../../config');

module.exports = {
    command: 'clearsesi',
    description: 'Menghapus semua file sesi kecuali creds.json untuk memperbaiki sesi yang rusak (Owner only).',
    category: 'Owner',
    run: async (sock, message, args) => {
        if (message.sender !== `${config.ownerNumber}@s.whatsapp.net`) {
            return message.reply('Perintah ini hanya untuk Owner.');
        }

        await message.reply('Membersihkan sesi lokal... Bot akan restart setelah selesai.');

        try {
            const sessionDir = path.join(__dirname, '..', '..', 'session');
            if (fs.existsSync(sessionDir)) {
                const files = fs.readdirSync(sessionDir);
                let count = 0;
                files.forEach(file => {
                    if (file !== 'creds.json') {
                        fs.unlinkSync(path.join(sessionDir, file));
                        count++;
                    }
                });
                await message.reply(`${count} file sesi lokal telah dibersihkan. Merestart...`);
            } else {
                await message.reply('Folder sesi lokal tidak ditemukan.');
            }

            setTimeout(() => process.exit(1), 2000);

        } catch (e) {
            await message.reply(`Gagal membersihkan sesi: ${e.message}`);
        }
    }
};