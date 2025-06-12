const db = require('../../lib/database');
const crypto = require('crypto');

const activeBeggars = new Map();

function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} menit ${seconds} detik`;
}

module.exports = {
    command: 'ngemis',
    description: 'Memulai sesi mengemis di grup untuk mendapatkan belas kasihan.',
    category: 'RPG',
    run: async (sock, message, args) => {
        if (!message.isGroup) {
            return message.reply('Fitur ini hanya bisa digunakan di dalam grup.');
        }

        const senderJid = message.sender;
        const cooldownTime = 30 * 60 * 1000;
        let cooldowns = db.get('cooldowns');
        const userCooldown = cooldowns[senderJid]?.ngemis || 0;

        if (Date.now() - userCooldown < cooldownTime) {
            const timeLeft = cooldownTime - (Date.now() - userCooldown);
            return message.reply(`Kamu baru saja mengemis. Istirahatkan dulu tenggorokanmu. Tunggu *${formatCooldown(timeLeft)}* lagi.`);
        }

        if (activeBeggars.has(message.from)) {
            const currentBeggar = activeBeggars.get(message.from);
            return message.reply(`Sabar, masih ada @${currentBeggar.beggarJid.split('@')[0]} yang lagi mangkal di sini.`, [currentBeggar.beggarJid]);
        }

        const begId = crypto.randomBytes(3).toString('hex');
        const sessionTimeout = 5 * 60 * 1000;

        const timeoutId = setTimeout(() => {
            if (activeBeggars.has(message.from)) {
                const session = activeBeggars.get(message.from);
                if (session.beggarJid === senderJid) {
                    sock.sendMessage(message.from, {
                        text: `Yah, belum ada yang ngasih. @${senderJid.split('@')[0]} berhenti ngemis karena tenggorokannya kering.`,
                        mentions: [senderJid]
                    });
                    activeBeggars.delete(message.from);
                }
            }
        }, sessionTimeout);

        activeBeggars.set(message.from, {
            beggarJid: senderJid,
            begId,
            timeout: timeoutId
        });

        if (!cooldowns[senderJid]) cooldowns[senderJid] = {};
        cooldowns[senderJid].ngemis = Date.now();
        db.save('cooldowns', cooldowns);

        const begMessage = `Aaaa kasian Aaaa, teeeh kasian teehh...\n\n@${senderJid.split('@')[0]} lagi butuh uang nih.\n\nBantu dia dengan ketik:\n*.kasih ${begId} <jumlah>*`;
        await sock.sendMessage(message.from, {
            text: begMessage,
            mentions: [senderJid]
        });
    }
};

module.exports.activeBeggars = activeBeggars;