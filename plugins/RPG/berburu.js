const db = require('../../lib/database');

function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} menit ${seconds} detik`;
}

module.exports = {
    command: 'berburu',
    description: 'Berburu hewan di hutan untuk mendapatkan hadiah.',
    category: 'Ekonomi',
    run: async (sock, message, args) => {
        const cooldownTime = 5 * 60 * 1000;
        const senderJid = message.sender;

        let cooldowns = db.get('cooldowns');
        const userCooldown = cooldowns[senderJid]?.berburu || 0;

        if (Date.now() - userCooldown < cooldownTime) {
            const timeLeft = cooldownTime - (Date.now() - userCooldown);
            return message.reply(`Anda baru saja selesai berburu. Hutan perlu waktu untuk pulih. Tunggu *${formatCooldown(timeLeft)}* lagi.`);
        }

        const outcomes = [{
            type: 'success',
            creature: 'Kelinci Hutan',
            message: `Dengan sigap, @${senderJid.split('@')[0]} berhasil menangkap Kelinci Hutan yang lincah!`,
            reward: [500, 1500]
        }, {
            type: 'success',
            creature: 'Babi Hutan',
            message: `Sebuah Babi Hutan menyeruduk, tapi @${senderJid.split('@')[0]} lebih tangguh dan berhasil menaklukkannya!`,
            reward: [2000, 5000]
        }, {
            type: 'success',
            creature: 'Rusa Emas',
            message: `Luar biasa! @${senderJid.split('@')[0]} menemukan dan berhasil membawa pulang Rusa Emas yang langka!`,
            reward: [8000, 15000]
        }, {
            type: 'failure',
            creature: 'Ular Berbisa',
            message: `Sial! Saat berburu, @${senderJid.split('@')[0]} digigit Ular Berbisa dan harus membayar biaya pengobatan.`,
            penalty: [1000, 2500]
        }, {
            type: 'nothing',
            creature: 'Angin Sepoi-sepoi',
            message: `Setelah seharian berjalan, @${senderJid.split('@')[0]} hanya merasakan angin sepoi-sepoi dan tidak menemukan hewan buruan apapun.`,
            penalty: 0
        }, ];

        const chosenOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        let usersDb = db.get('users');
        const user = usersDb[senderJid] || {
            balance: 0
        };
        let replyText = '';

        if (chosenOutcome.type === 'success') {
            const amount = Math.floor(Math.random() * (chosenOutcome.reward[1] - chosenOutcome.reward[0] + 1)) + chosenOutcome.reward[0];
            user.balance += amount;
            replyText = `*Perburuan Berhasil!* 🏹\n\n${chosenOutcome.message}\n\n*Hadiah:* Rp ${amount.toLocaleString()}\n*Saldo Baru:* Rp ${user.balance.toLocaleString()}`;
        } else if (chosenOutcome.type === 'failure') {
            const penaltyAmount = Math.floor(Math.random() * (chosenOutcome.penalty[1] - chosenOutcome.penalty[0] + 1)) + chosenOutcome.penalty[0];
            const finalPenalty = Math.min(user.balance, penaltyAmount);
            user.balance -= finalPenalty;
            replyText = `*Perburuan Gagal!* 💔\n\n${chosenOutcome.message}\n\n*Kerugian:* Rp ${finalPenalty.toLocaleString()}\n*Saldo Baru:* Rp ${user.balance.toLocaleString()}`;
        } else {
            replyText = `*Hutan Sedang Sepi* 🌲\n\n${chosenOutcome.message}`;
        }

        usersDb[senderJid] = user;
        if (!cooldowns[senderJid]) cooldowns[senderJid] = {};
        cooldowns[senderJid].berburu = Date.now();

        db.save('users', usersDb);
        db.save('cooldowns', cooldowns);

        await sock.sendMessage(message.from, {
            text: replyText,
            mentions: [senderJid]
        });
    }
};