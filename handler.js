const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('./config');
const { serialize } = require('./lib/serialize');

const plugins = new Map();
const pluginsDir = path.join(__dirname, 'plugins');
const activeTimeouts = {};

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
    
    const dbDir = path.join(__dirname, 'database');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir);
    ['afk.json', 'groupSettings.json', 'users.json', 'gameSessions.json'].forEach(file => {
        const filePath = path.join(dbDir, file);
        if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '{}');
    });
    
    let usersData = JSON.parse(fs.readFileSync(path.join(dbDir, 'users.json')));
    let isAccepted = usersData[message.sender] && usersData[message.sender].accepted;
    const isOwner = message.sender.startsWith(config.ownerNumber);
    
    if (message.body) {
        const timestamp = new Date().toLocaleTimeString();
        const from = message.pushName;
        const inType = message.isGroup ? 'Grup' : 'Pribadi';
        const groupName = message.isGroup ? ` di ${chalk.yellow((await sock.groupMetadata(message.from)).subject)}` : '';
        console.log(`[${chalk.gray(timestamp)}] [${chalk.yellow(inType)}] dari ${chalk.green(from)}${groupName}: ${chalk.white(message.body)}`);
    }
    
    if (isAccepted || isOwner) {
        let afkData = JSON.parse(fs.readFileSync(path.join(dbDir, 'afk.json')));
        let groupSettingsData = JSON.parse(fs.readFileSync(path.join(dbDir, 'groupSettings.json')));
        let gameSessions = JSON.parse(fs.readFileSync(path.join(dbDir, 'gameSessions.json')));
        
        if (message.isGroup) {
            if (afkData[message.from] && afkData[message.from][message.sender]) {
                const afkInfo = afkData[message.from][message.sender];
                const duration = formatAfkDuration(Date.now() - afkInfo.time);
                await message.reply(`👋 *Selamat datang kembali!*\n\nAnda telah AFK selama *${duration}* di grup ini.`);
                delete afkData[message.from][message.sender];
                fs.writeFileSync(path.join(dbDir, 'afk.json'), JSON.stringify(afkData, null, 2));
            }
            const mentionedJids = message.msg?.contextInfo?.mentionedJid || [];
            const quotedUserJid = message.msg?.contextInfo?.participant;
            const jidsToCheck = [...mentionedJids];
            if (quotedUserJid && !jidsToCheck.includes(quotedUserJid)) jidsToCheck.push(quotedUserJid);
            for (const jid of jidsToCheck) {
                if (jid === message.sender) continue;
                if (afkData[message.from] && afkData[message.from][jid]) {
                    const afkInfo = afkData[message.from][jid];
                    const duration = formatAfkDuration(Date.now() - afkInfo.time);
                    await sock.sendMessage(message.from, { text: `🤫 Jangan ganggu dia!\n\n*User:* @${jid.split('@')[0]}\n*Status:* AFK sejak *${duration}* lalu\n*Alasan:* ${afkInfo.reason}`, mentions: [jid] }, { quoted: message });
                }
            }
        }
        
        if (gameSessions[message.from] && message.body && message.body.trim().toUpperCase() === gameSessions[message.from].answer.toUpperCase()) {
            const session = gameSessions[message.from];
            clearTimeout(activeTimeouts[message.from]);
            delete activeTimeouts[message.from];
            
            const reward = session.reward;
            usersData[message.sender].money = (usersData[message.sender]?.money || 0) + reward;
            fs.writeFileSync(path.join(dbDir, 'users.json'), JSON.stringify(usersData, null, 2));
            
            await message.reply(`🎉 *Benar!* Jawaban yang tepat adalah *${session.answer}*.\n\nAnda mendapatkan *Rp ${reward.toLocaleString()}*!`);
            
            delete gameSessions[message.from];
            fs.writeFileSync(path.join(dbDir, 'gameSessions.json'), JSON.stringify(gameSessions, null, 2));
            return;
        }
        
        await handleAntiLink(sock, message, groupSettingsData);
    }
    
    if (config.autoRead) await sock.readMessages([message.key]);
    
    const isBot = message.sender === sock.user.id.split(':')[0] + '@s.whatsapp.net';
    if (!config.isPublic && !isOwner && !isBot) return;
    
    if (!message.body || !message.body.startsWith(config.prefix)) return;
    
    const args = message.body.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    const plugin = plugins.get(command);
    
    if (plugin) {
        if (command !== 'accept' && !isAccepted && !isOwner) {
            return message.reply(`Anda belum menyetujui syarat dan ketentuan bot.\nKetik *.accept* untuk menyetujui dan membuka semua fitur.`);
        }
        
        if (config.autoTyping) await sock.sendPresenceUpdate('composing', message.from);
        try {
            await plugin.run(sock, message, args);
        } catch (e) {
            console.error(`Error saat menjalankan plugin ${command}:`, e);
            message.reply(`Terjadi kesalahan: ${e.message}`);
        }
    }
};