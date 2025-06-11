const db = require('../../lib/database');

function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} menit ${seconds} detik`;
}

module.exports = {
    command: 'rampok',
    description: 'Mencoba merampok saldo pengguna lain.',
    run: async (sock, message, args) => {
        const cooldownTime = 30 * 60 * 1000;
        let cooldowns = db.get('cooldowns');
        const userCooldown = cooldowns[message.sender]?.rampok || 0;

        if (Date.now() - userCooldown < cooldownTime) {
            const timeLeft = cooldownTime - (Date.now() - userCooldown);
            return message.reply(`Anda baru saja merampok. Tunggu *${formatCooldown(timeLeft)}* lagi.`);
        }

        const mentionedJid = message.msg?.contextInfo?.mentionedJid?.[0];
        const targetJid = mentionedJid || message.msg?.contextInfo?.participant;
        if (!targetJid || targetJid === message.sender) return message.reply('Gunakan format: *.rampok @target* atau reply pesan target.');
        
        let usersDb = db.get('users');
        const targetUser = usersDb[targetJid] || { balance: 0 };
        const robberUser = usersDb[message.sender] || { balance: 0 };
        
        if (targetUser.balance < 1000) return message.reply(`Dia miskin anjr, jangan dirampok.`);
        
        if (!cooldowns[message.sender]) cooldowns[message.sender] = {};
        cooldowns[message.sender].rampok = Date.now();
        db.save('cooldowns', cooldowns);

        const successChance = 0.4;
        const random = Math.random();

        if (random > successChance) {
            const defenses = ["menodongkan pistol", "mengeluarkan golok", "menendang peler nya", "melempar batu", "memanggil hansip"];
            const defense = defenses[Math.floor(Math.random() * defenses.length)];
            const failMessage = `@${targetJid.split('@')[0]} berhasil menghalau @${message.sender.split('@')[0]} dan ${defense}!`;
            return sock.sendMessage(message.from, { text: failMessage, mentions: [targetJid, message.sender] });
        }
        
        const amountStolen = Math.floor(targetUser.balance * (Math.random() * 0.4 + 0.1));
        
        robberUser.balance += amountStolen;
        targetUser.balance -= amountStolen;
        usersDb[message.sender] = robberUser;
        usersDb[targetJid] = targetUser;
        db.save('users', usersDb);

        const successMessages = [
            `@${targetJid.split('@')[0]} menangis tersedu-sedu karena berhasil dirampok oleh @${message.sender.split('@')[0]} sebesar Rp ${amountStolen.toLocaleString()}`,
            `Dengan keahliannya, @${message.sender.split('@')[0]} berhasil menggasak Rp ${amountStolen.toLocaleString()} dari @${targetJid.split('@')[0]}!`,
            `Dompet @${targetJid.split('@')[0]} kini lebih ringan! @${message.sender.split('@')[0]} membawa kabur Rp ${amountStolen.toLocaleString()}.`
        ];
        const successMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
        await sock.sendMessage(message.from, { text: successMessage, mentions: [targetJid, message.sender] });
    }
};