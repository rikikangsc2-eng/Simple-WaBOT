const fs = require('fs');
const path = require('path');
const config = require('./config');
const { serialize } = require('./lib/serialize');

const plugins = new Map();
const pluginsDir = path.join(__dirname, 'plugins');

fs.readdirSync(pluginsDir).forEach(category => {
    const categoryDir = path.join(pluginsDir, category);
    if (fs.statSync(categoryDir).isDirectory()) {
        fs.readdirSync(categoryDir).forEach(file => {
            if (path.extname(file) === '.js') {
                try {
                    const pluginPath = path.join(categoryDir, file);
                    const plugin = require(pluginPath);
                    if (plugin.command && plugin.run) {
                        plugins.set(plugin.command, plugin);
                    }
                } catch (e) {
                    console.error(`Gagal memuat plugin ${file} di kategori ${category}:`, e);
                }
            }
        });
    }
});


module.exports = async (sock, m) => {
    if (!m) return;

    const message = await serialize(sock, m);

    if (config.autoRead) {
        await sock.readMessages([message.key]);
    }

    if (!message.body || !message.body.startsWith(config.prefix)) return;

    const args = message.body.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const plugin = plugins.get(command);

    if (plugin) {
        if (config.autoTyping) {
            await sock.sendPresenceUpdate('composing', message.from);
        }

        try {
            await plugin.run(message, args);
        } catch (e) {
            console.error(`Error saat menjalankan plugin ${command}:`, e);
            message.reply(`Terjadi kesalahan: ${e.message}`);
        }
    }
};