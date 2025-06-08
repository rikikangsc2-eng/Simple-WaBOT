const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
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
                        if (Array.isArray(plugin.command)) {
                            plugin.command.forEach(alias => plugins.set(alias, plugin));
                        } else {
                            plugins.set(plugin.command, plugin);
                        }
                    }
                } catch (e) {
                    console.error(`Gagal memuat plugin ${file} di kategori ${category}:`, e);
                }
            }
        });
    }
});

function formatAfkDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    let duration = [];
    if (days > 0) duration.push(`${days} hari`);
    if (hours > 0) duration.push(`${hours} jam`);
    if (minutes > 0) duration.push(`${minutes} menit`);
    if (seconds > 0) duration.push(`${seconds} detik`);
    
    return duration.join(', ') || 'beberapa saat';
}

async function handleAntiLink(sock, message, settings) {
    if (!message.isGroup || !message.body) return;
    const groupSetting = settings[message.from];
    if (!groupSetting || !groupSetting.isAntilinkEnabled) return;
    
    const linkRegex = /https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]{22}/g;
    if (linkRegex.test(message.body)) {
        const groupMeta = await sock.groupMetadata(message.from);
        const sender = groupMeta.participants.find(p => p.id === message.sender);
        const isAdmin = sender && (sender.admin === 'admin' || sender.admin === 'superadmin');
        const isOwner = message.sender.startsWith(config.ownerNumber);
        
        if (isAdmin || isOwner) return;
        
        const bot = groupMeta.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net');
        const isBotAdmin = bot && (bot.admin === 'admin' || bot.admin === 'superadmin');
        
        if (!isBotAdmin) return console.log(chalk.yellow(`Bot bukan admin di grup ${groupMeta.subject}, tidak bisa menjalankan anti link.`));
        
        await message.reply('Terdeteksi link grup WhatsApp! Anda akan dikeluarkan.');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sock.groupParticipantsUpdate(message.from, [message.sender], 'remove');
    }
}

module.exports = async (sock, m) => {
    if (!m) return;
    const message = await serialize(sock, m);
    
    if (message.body) {
        const timestamp = new Date().toLocaleTimeString();
        const from = message.pushName;
        const inType = message.isGroup ? 'Grup' : 'Pribadi';
        const groupName = message.isGroup ? ` di ${chalk.yellow((await sock.groupMetadata(message.from)).subject)}` : '';
        const log = `[${chalk.gray(timestamp)}] [${chalk.yellow(inType)}] dari ${chalk.green(from)}${groupName}: ${chalk.white(message.body)}`;
        console.log(log);
    }
    
    const dbDir = path.join(__dirname, 'database');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
    const afkPath = path.join(dbDir, 'afk.json');
    if (!fs.existsSync(afkPath)) fs.writeFileSync(afkPath, '{}');
    const groupSettingsPath = path.join(dbDir, 'groupSettings.json');
    if (!fs.existsSync(groupSettingsPath)) fs.writeFileSync(groupSettingsPath, '{}');
    
    let afkData = JSON.parse(fs.readFileSync(afkPath));
    let groupSettingsData = JSON.parse(fs.readFileSync(groupSettingsPath));
    
    await handleAntiLink(sock, message, groupSettingsData);
    
    const mentionedJids = message.msg?.contextInfo?.mentionedJid || [];
    if (afkData[message.sender]) {
        const afkInfo = afkData[message.sender];
        const duration = formatAfkDuration(Date.now() - afkInfo.time);
        await message.reply(`👋 *Selamat datang kembali!*\n\nAnda telah AFK selama *${duration}*.`);
        delete afkData[message.sender];
        fs.writeFileSync(afkPath, JSON.stringify(afkData, null, 2));
    }
    
    for (const jid of mentionedJids) {
        if (afkData[jid]) {
            const afkInfo = afkData[jid];
            const duration = formatAfkDuration(Date.now() - afkInfo.time);
            const response = `🤫 Jangan ganggu dia!\n\n*User:* @${jid.split('@')[0]}\n*Status:* AFK sejak *${duration}* lalu\n*Alasan:* ${afkInfo.reason}`;
            await sock.sendMessage(message.from, { text: response, mentions: [jid] }, { quoted: message });
        }
    }
    
    if (config.autoRead) {
        await sock.readMessages([message.key]);
    }
    
    const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isOwner = message.sender === ownerJid;
    const isBot = message.sender === botJid;
    
    if (!config.isPublic && !isOwner && !isBot) {
        return;
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
            await plugin.run(sock, message, args);
        } catch (e) {
            console.error(`Error saat menjalankan plugin ${command}:`, e);
            message.reply(`Terjadi kesalahan: ${e.message}`);
        }
    }
};