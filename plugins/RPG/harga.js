const db = require('../../lib/database');

module.exports = {
    command: 'harga',
    description: 'Melihat harga item di pasar.',
    run: async (sock, message, args) => {
        const market = db.get('market');
        let response = '📊 *Harga Pasar Saat Ini*\n\n';
        const items = { gold: '🪙 Emas', iron: '🔩 Iron', bara: '🔥 Bara' };
        Object.keys(items).forEach(item => {
            const currentPrice = market[`${item}_price`];
            const lastPrice = market[`last_${item}_price`];
            let trendEmoji = '➖';
            if (currentPrice > lastPrice) trendEmoji = '📈';
            if (currentPrice < lastPrice) trendEmoji = '📉';
            response += `*${items[item]}*:\nRp ${currentPrice.toLocaleString()} /gram ${trendEmoji}\n\n`;
        });
        await message.reply(response);
    }
};