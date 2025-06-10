const fs = require('fs');
const path = require('path');
const config = require('./config');
const { serialize } = require('./lib/serialize');
const db = require('./lib/database');
const logger = require('./lib/logger');

const plugins = new Map();
const activeGames = new Map();
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
                    logger.error(`Gagal memuat plugin ${file} di kategori ${category}:`, e);
                }
            }
        });
    }
});

async function handleGame(sock, message) {
    if (!message.isGroup || !activeGames.has(message.from)) return false;
    
    const game = activeGames.get(message.from);
    if (message.body.toLowerCase() !== game.jawaban.toLowerCase()) return false;

    clearTimeout(game.timeout);
    
    let usersDb = db.get('users');
    if (!usersDb[message.sender]) {
        usersDb[message.sender] = { balance: 0, name: message.pushName };
    }
    usersDb[message.sender].balance += game.hadiah;
    usersDb[message.sender].name = message.pushName;
    db.save('users', usersDb);

    const winMessage = `🎉 *Selamat, ${message.pushName}!* Jawaban Anda benar.\n\nAnda mendapatkan *Rp ${game.hadiah.toLocaleString()}*`;
    await message.reply(winMessage);
    
    activeGames.delete(message.from);
    return true;
}

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

        if (!isBotAdmin) {
            logger.warn(`Bot bukan admin di grup ${groupMeta.subject}, tidak bisa menjalankan anti link.`);
            return;
        }
        
        await message.reply('Terdeteksi link grup WhatsApp! Anda akan dikeluarkan.');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sock.groupParticipantsUpdate(message.from, [message.sender], 'remove');
    }
}

module.exports = async (sock, m) => {
    if (!m) return;
    const message = await serialize(sock, m);
    
    if (message.body) {
        const from = message.pushName;
        const inType = message.isGroup ? 'Grup' : 'Pribadi';
        const groupName = message.isGroup ? ` di ${(await sock.groupMetadata(message.from)).subject}` : '';
        logger.info(`${inType} dari ${from}${groupName}: ${message.body}`);
    }
    
    if (await handleGame(sock, message)) return;

    let afkData = db.get('afk');
    let groupSettingsData = db.get('groupSettings');

    await handleAntiLink(sock, message, groupSettingsData);
    
    const mentionedJids = message.msg?.contextInfo?.mentionedJid || [];
    const quotedUserJid = message.msg?.contextInfo?.participant;
    const jidsToCheck = [...mentionedJids];

    if (quotedUserJid && !jidsToCheck.includes(quotedUserJid)) {
        jidsToCheck.push(quotedUserJid);
    }

    if (afkData[message.sender]) {
        const afkInfo = afkData[message.sender];
        const duration = formatAfkDuration(Date.now() - afkInfo.time);
        await message.reply(`👋 *Selamat datang kembali!*\n\nAnda telah AFK selama *${duration}*.`);
        delete afkData[message.sender];
        db.save('afk', afkData);
    }
    
    for (const jid of jidsToCheck) {
        if (jid === message.sender) continue;
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
            await plugin.run(sock, message, args, { activeGames });
        } catch (e) {
            logger.error(`Error saat menjalankan plugin ${command}:`, e);
            message.reply(`Terjadi kesalahan: ${e.message}`);
        }
    }
};