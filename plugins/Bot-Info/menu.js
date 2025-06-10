const fs = require('fs');
const path = require('path');
const os = require('os');
const process = require('process');
const config = require('../../config');
const { getBuffer } = require('../../lib/functions');

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
    command: ['menu', 'help'],
    description: 'Menampilkan semua fitur yang tersedia.',
    run: async (sock, message, args) => {
        const usedMem = process.memoryUsage().heapUsed / 1024 / 1024;
        const uptime = process.uptime();
        
        const pluginsDir = path.join(__dirname, '..');
        const commandCategories = {};
        
        fs.readdirSync(pluginsDir).forEach(category => {
            const categoryDir = path.join(pluginsDir, category);
            if (fs.statSync(categoryDir).isDirectory()) {
                const plugins = [];
                fs.readdirSync(categoryDir).forEach(file => {
                    if (path.extname(file) !== '.js') return;
                    try {
                        const pluginPath = path.join(categoryDir, file);
                        const plugin = require(pluginPath);
                        if (plugin.command && plugin.description) {
                            plugins.push(plugin);
                        }
                    } catch (e) {
                        console.error(`Gagal memuat info plugin dari ${file}`);
                    }
                });
                if (plugins.length > 0) {
                    commandCategories[category] = plugins;
                }
            }
        });
        
        const priorityCategories = ['Owner', 'Group', 'AI', 'Downloader', 'Tools'];
        const sortedCategories = Object.keys(commandCategories).sort((a, b) => {
            const indexA = priorityCategories.indexOf(a);
            const indexB = priorityCategories.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
        
        let menuText = `*Hai, ${message.pushName || 'User'}!*
Bot ini siap membantu Anda.

┌─「 *BOT STATUS* 」
│ ❖ *Owner* : ${config.ownerName}
│ ❖ *Uptime* : ${formatUptime(uptime)}
│ ❖ *RAM* : ${usedMem.toFixed(2)} MB
└─\n\n`;
        
        for (const category of sortedCategories) {
            menuText += `┌─「 *${category}* 」\n`;
            commandCategories[category].forEach(plugin => {
                const mainCommand = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
                menuText += `│ ❖ ${config.prefix}${mainCommand}\n`;
            });
            menuText += `└─\n\n`;
        }
        
        menuText += `Ketik *.command* untuk menggunakan fitur.`;
        
        let userThumb;
        try {
            const ppUrl = await sock.profilePictureUrl(message.sender, 'image');
            userThumb = await getBuffer(ppUrl);
        } catch (e) {
            userThumb = null;
        }
        
        const menuMessage = {
            text: menuText,
            contextInfo: {
                externalAdReply: {
                    title: config.botName,
                    body: `© ${config.ownerName}`,
                    thumbnail: userThumb,
                    sourceUrl: `https://wa.me/${config.ownerNumber}`,
                    mediaType: 1
                }
            }
        };
        
        if (userThumb) {
            await sock.sendMessage(message.from, menuMessage, { quoted: message });
        } else {
            await message.reply(menuText);
        }
    }
};