const db = require('../../lib/database');

module.exports = {
    command: 'jual',
    description: 'Menjual item ke pasar.',
    run: async (sock, message, args) => {
        const item = args[0]?.toLowerCase();
        if (item !== 'emas' && item !== 'iron' && item !== 'bara') {
            return message.reply('Item tidak ditemukan. Gunakan: *.jual <emas|iron|bara> <jumlah>*');
        }
        const amount = parseFloat(args[1]);
        if (isNaN(amount) || amount <= 0) return message.reply('Masukkan jumlah yang valid untuk dijual.');
        let usersDb = db.get('users');
        const user = usersDb[message.sender] || { balance: 0 };
        if (!user[item] || user[item] < amount) {
            return message.reply(`Anda tidak memiliki cukup ${item} untuk dijual.\n\n*${item.charAt(0).toUpperCase() + item.slice(1)} Anda:* ${user[item] || 0} gram`);
        }
        const market = db.get('market');
        const price = market[`${item}_price`];
        const totalIncome = Math.floor(price * amount);
        user[item] -= amount;
        user.balance = (user.balance || 0) + totalIncome;
        usersDb[message.sender] = user;
        db.save('users', usersDb);
        await message.reply(`✅ *Penjualan Berhasil*\n\n- *Item:* ${item}\n- *Jumlah:* ${amount} gram\n- *Total Pendapatan:* Rp ${totalIncome.toLocaleString()}\n- *Saldo Baru:* Rp ${user.balance.toLocaleString()}`);
    }
};