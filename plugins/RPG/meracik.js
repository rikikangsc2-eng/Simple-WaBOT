const db = require('../../lib/database');

function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} menit ${seconds} detik`;
}

const recipes = {
    baja: {
        result: { item: 'baja', amount: 1 },
        ingredients: { iron: 10, bara: 5 },
        description: 'Menciptakan 1 batang Baja dari 10 Iron dan 5 Bara.'
    },
    pedanglegendaris: {
        result: { item: 'pedanglegendaris', amount: 1 },
        ingredients: { baja: 2, emas: 5 },
        description: 'Menempa 1 Pedang Legendaris dari 2 Baja dan 5 Emas.'
    },
};

module.exports = {
    command: 'meracik',
    description: 'Meracik item baru dari bahan yang dimiliki.',
    category: 'Ekonomi',
    run: async (sock, message, args) => {
        const cooldownTime = 2 * 60 * 1000;
        const senderJid = message.sender;

        let cooldowns = db.get('cooldowns');
        const userCooldown = cooldowns[senderJid]?.meracik || 0;

        if (Date.now() - userCooldown < cooldownTime) {
            const timeLeft = cooldownTime - (Date.now() - userCooldown);
            return message.reply(`Tanganmu masih pegal karena meracik. Tunggu *${formatCooldown(timeLeft)}* lagi.`);
        }

        const recipeName = args[0]?.toLowerCase();

        if (!recipeName) {
            let availableRecipes = '📜 *Buku Resep* 📜\n\n';
            availableRecipes += 'Gunakan: *.meracik <nama_resep>*\n\n';
            for (const name in recipes) {
                availableRecipes += `* Rezept: *${name.charAt(0).toUpperCase() + name.slice(1)}*\n`;
                availableRecipes += `  - Hasil: ${recipes[name].result.amount} ${recipes[name].result.item}\n`;
                availableRecipes += `  - Bahan: ${Object.entries(recipes[name].ingredients).map(([item, amount]) => `${amount} ${item}`).join(', ')}\n\n`;
            }
            return message.reply(availableRecipes);
        }

        const recipe = recipes[recipeName];
        if (!recipe) {
            return message.reply(`Resep untuk *"${recipeName}"* tidak ditemukan. Cek buku resep dengan mengetik *.meracik*`);
        }

        let usersDb = db.get('users');
        const user = usersDb[senderJid] || {};
        const requiredIngredients = recipe.ingredients;

        const hasAllIngredients = Object.keys(requiredIngredients).every(item => {
            return (user[item] || 0) >= requiredIngredients[item];
        });

        if (!hasAllIngredients) {
            let missingText = 'Bahan tidak cukup! Anda memerlukan:\n';
            for (const item in requiredIngredients) {
                const required = requiredIngredients[item];
                const owned = user[item] || 0;
                missingText += `- ${item}: ${owned}/${required} (${owned < required ? 'Kurang' : 'Cukup'})\n`;
            }
            return message.reply(missingText);
        }

        for (const item in requiredIngredients) {
            user[item] -= requiredIngredients[item];
        }

        const resultItem = recipe.result.item;
        const resultAmount = recipe.result.amount;
        user[resultItem] = (user[resultItem] || 0) + resultAmount;

        usersDb[senderJid] = user;
        if (!cooldowns[senderJid]) cooldowns[senderJid] = {};
        cooldowns[senderJid].meracik = Date.now();

        db.save('users', usersDb);
        db.save('cooldowns', cooldowns);
        
        const successText = `*Sukses Meracik!* ✨\n\n@${senderJid.split('@')[0]} berhasil menciptakan *${resultAmount} ${resultItem.charAt(0).toUpperCase() + resultItem.slice(1)}*!`;
        await sock.sendMessage(message.from, { text: successText, mentions: [senderJid] });
    }
};