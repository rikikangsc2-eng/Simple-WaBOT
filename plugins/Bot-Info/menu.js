const fs = require('fs');
const path = require('path');
const os = require('os');
const process = require('process');
const config = require('../../config'); 

function formatUptime(seconds) {
    function pad(s) {
        return (s < 10 ? '0' : '') + s;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    seconds = Math.floor(seconds % 60);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

module.exports = {
    command: 'menu',
    description: 'Menampilkan semua fitur yang tersedia.',
    run: async (sock, message, args) =>  {
        const usedMem = process.memoryUsage().heapUsed / 1024 / 1024;
        const uptime = process.uptime();

        const pluginsDir = path.join(__dirname, '..'); // <-- PATH BERUBAH
        const commandCategories = {};
        const categoryOrder = ['Owner', 'AI', 'Downloader', 'Tools', 'Fun', 'Lainnya'];

        fs.readdirSync(pluginsDir).forEach(category => {
            const categoryDir = path.join(pluginsDir, category);
            if (fs.statSync(categoryDir).isDirectory()) {
                commandCategories[category] = [];
                fs.readdirSync(categoryDir).forEach(file => {
                    if (path.extname(file) !== '.js') return;
                    try {
                        const pluginPath = path.join(categoryDir, file);
                        const plugin = require(pluginPath);
                        if (plugin.command && plugin.description) {
                            commandCategories[category].push(plugin);
                        }
                    } catch (e) {
                        console.error(`Gagal memuat info plugin dari ${file}`);
                    }
                });
            }
        });

        let menuText = `*Hai, ${message.pushName || 'User'}!*
Bot ini siap membantu Anda.

┌─「 *BOT STATUS* 」
│ ❖ *Owner* : ${config.ownerNumber}
│ ❖ *Uptime* : ${formatUptime(uptime)}
│ ❖ *RAM* : ${usedMem.toFixed(2)} MB
└─\n\n`;

        for (const category of categoryOrder) {
            if (commandCategories[category] && commandCategories[category].length > 0) {
                menuText += `┌─「 *${category}* 」\n`;
                commandCategories[category].forEach(plugin => {
                    menuText += `│ ❖ ${config.prefix}${plugin.command}\n`;
                });
                menuText += `└─\n\n`;
            }
        }

        menuText += `Ketik *.command* untuk menggunakan fitur.`;

        await message.reply(menuText);
    }
};