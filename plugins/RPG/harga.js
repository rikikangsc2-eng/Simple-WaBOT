// PATH: /plugins/Ekonomi/harga.js
const db = require('../../lib/database');

module.exports = {
    command: 'harga',
    description: 'Melihat harga item di pasar.',
    run: async (sock, message, args) => {
        const market = db.get('market') || {};
        let response = '📊 *Harga Pasar Saat Ini*\n\n';
        const items = { emas: '🪙 Emas', iron: '🔩 Iron', bara: '🔥 Bara' };
        
        Object.keys(items).forEach(item => {
            const currentPrice = market[`${item}_price`];
            const lastPrice = market[`last_${item}_price`];
            
            response += `*${items[item]}*:\n`;
            
            if (typeof currentPrice === 'number' && !isNaN(currentPrice)) {
                let trendEmoji = '➖';
                if (typeof lastPrice === 'number' && !isNaN(lastPrice)) {
                    if (currentPrice > lastPrice) trendEmoji = '📈';
                    if (currentPrice < lastPrice) trendEmoji = '📉';
                }
                response += `Rp ${currentPrice.toLocaleString()} /gram ${trendEmoji}\n\n`;
            } else {
                response += `Harga belum tersedia\n\n`;
            }
        });
        
        await message.reply(response);
    }
};