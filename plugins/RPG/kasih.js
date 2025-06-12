const db = require('../../lib/database');
const {
    activeBeggars
} = require('./ngemis.js');

module.exports = {
    command: 'kasih',
    description: 'Memberikan uang kepada seseorang yang sedang mengemis.',
    category: 'RPG',
    run: async (sock, message, args) => {
        if (!message.isGroup) {
            return message.reply('Fitur ini hanya bisa digunakan di dalam grup.');
        }

        const begSession = activeBeggars.get(message.from);
        if (!begSession) {
            return message.reply('Tidak ada yang sedang mengemis di sini saat ini.');
        }

        const inputId = args[0];
        const amount = parseInt(args[1]);

        if (!inputId || isNaN(amount) || amount <= 0) {
            return message.reply(`Gunakan format yang benar:\n*.kasih ${begSession.begId} <jumlah>*`);
        }

        if (inputId.toLowerCase() !== begSession.begId) {
            return message.reply(`ID tidak valid. Gunakan ID yang benar untuk memberi: *${begSession.begId}*`);
        }

        const senderJid = message.sender;
        const {
            beggarJid,
            timeout
        } = begSession;

        if (senderJid === beggarJid) {
            return message.reply('Anda tidak bisa memberi kepada diri sendiri, aneh.');
        }

        let usersDb = db.get('users');
        const donator = usersDb[senderJid] || {
            balance: 0
        };

        if (donator.balance < amount) {
            return message.reply(`Uangmu tidak cukup untuk beramal. Saldo Anda: Rp ${donator.balance.toLocaleString()}`);
        }

        const beggar = usersDb[beggarJid] || {
            balance: 0
        };

        donator.balance -= amount;
        beggar.balance += amount;

        usersDb[senderJid] = donator;
        usersDb[beggarJid] = beggar;
        db.save('users', usersDb);

        clearTimeout(timeout);
        activeBeggars.delete(message.from);

        const replyText = `✨ Terimakasih orang baik! @${beggarJid.split('@')[0]} telah menerima sedekah sebesar *Rp ${amount.toLocaleString()}* dari @${senderJid.split('@')[0]}. Sehat selalu ya!`;
        await sock.sendMessage(message.from, {
            text: replyText,
            mentions: [beggarJid, senderJid]
        });
    }
};