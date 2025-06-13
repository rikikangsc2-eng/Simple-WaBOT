const db = require('../../lib/database');

module.exports = {
    command: 'beli',
    description: 'Membeli item dari pasar.',
    run: async (sock, message, args) => {
        const item = args[0]?.toLowerCase();
        if (!['emas', 'iron', 'bara'].includes(item)) {
            return message.reply('Item tidak ditemukan. Gunakan: *.beli <emas|iron|bara> <jumlah>*');
        }

        const amount = parseFloat(args[1]);
        if (isNaN(amount) || amount <= 0) {
            return message.reply('Masukkan jumlah yang valid untuk dibeli.');
        }

        const market = db.get('market');
        const price = market[`${item}_price`];

        if (typeof price !== 'number' || isNaN(price)) {
            return message.reply(`Maaf, harga untuk "${item}" saat ini tidak tersedia di pasar. Silakan cek lagi nanti.`);
        }

        const totalCost = Math.ceil(price * amount);
        let usersDb = db.get('users');
        const user = usersDb[message.sender] || { balance: 0, emas: 0, iron: 0, bara: 0 };

        if (user.balance < totalCost) {
            return message.reply(`Saldo Anda tidak cukup.\n\n*Saldo Anda:* Rp ${user.balance.toLocaleString()}\n*Harga Beli:* Rp ${totalCost.toLocaleString()} untuk ${amount} gram ${item}.`);
        }

        user.balance -= totalCost;
        user[item] = (user[item] || 0) + amount;
        usersDb[message.sender] = user;
        db.save('users', usersDb);

        const replyText = `✅ *Pembelian Berhasil*\n\n` +
            `- *Item:* ${item.charAt(0).toUpperCase() + item.slice(1)}\n` +
            `- *Jumlah:* ${amount} gram\n` +
            `- *Total Biaya:* Rp ${totalCost.toLocaleString()}\n` +
            `- *Saldo Tersisa:* Rp ${user.balance.toLocaleString()}`;

        await message.reply(replyText);
    }
};