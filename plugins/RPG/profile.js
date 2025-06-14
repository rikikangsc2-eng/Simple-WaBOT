const db = require('../../lib/database');

module.exports = {
    command: 'profile',
    description: 'Melihat profil, saldo, dan aset Anda.',
    run: async (sock, message, args) => {
        const usersDb = db.get('users');
        const user = usersDb[message.sender] || {
            balance: 0,
            gold: 0,
            iron: 0,
            bara: 0,
            baja: 0,
            pedanglegendaris: 0
        };

        const profileText = `👤 *Profil Pengguna*\n` +
            `*Nama:* ${message.pushName}\n\n` +
            `*Aset:*\n` +
            `- *Saldo:* Rp ${(user.balance || 0).toLocaleString()}\n` +
            `- *Emas:* ${(user.gold || 0).toFixed(3)} gram\n` +
            `- *Iron:* ${(user.iron || 0).toFixed(3)} gram\n` +
            `- *Bara:* ${(user.bara || 0).toFixed(3)} gram\n\n` +
            `*Perlengkapan:*\n` +
            `- *Baja:* ${user.baja || 0} batang\n` +
            `- *Pedang Legendaris:* ${user.pedanglegendaris || 0} buah`;

        await message.reply(profileText);
    }
};