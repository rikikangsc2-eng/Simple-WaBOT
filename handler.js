const config = require('./config');
const { serialize } = require('./lib/serialize');
const db = require('./lib/database');
const logger = require('./lib/logger');
const { plugins } = require('./lib/pluginManager');

const activeGames = new Map();

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

async function handleAntiLink(sock, message, groupMetadata) {
    if (!message.isGroup || !message.body || !groupMetadata) return;
    
    const groupSettings = db.get('groupSettings');
    const groupSetting = groupSettings[message.from];
    if (!groupSetting || !groupSetting.isAntilinkEnabled) return;

    const linkRegex = /https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]{22}/g;
    if (linkRegex.test(message.body)) {
        const sender = groupMetadata.participants.find(p => p.id === message.sender);
        const isAdmin = sender && (sender.admin === 'admin' || sender.admin === 'superadmin');
        const isOwner = message.sender.startsWith(config.ownerNumber);

        if (isAdmin || isOwner) return;

        const bot = groupMetadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net');
        const isBotAdmin = bot && (bot.admin === 'admin' || bot.admin === 'superadmin');

        if (!isBotAdmin) return;

        await message.reply('Terdeteksi link grup WhatsApp! Anda akan dikeluarkan.');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await sock.groupParticipantsUpdate(message.from, [message.sender], 'remove');
    }
}

const handler = async (sock, m, { groupMetadataCache }) => {
    if (!m) return;
    const message = await serialize(sock, m);

    let groupMetadata = null;
    if (message.isGroup) {
        if (groupMetadataCache.has(message.from)) {
            groupMetadata = groupMetadataCache.get(message.from);
        } else {
            groupMetadata = await sock.groupMetadata(message.from);
            groupMetadataCache.set(message.from, groupMetadata);
        }
    }

    if (message.body) {
        const from = message.pushName;
        const inType = message.isGroup ? 'Grup' : 'Pribadi';
        const groupName = message.isGroup ? ` di ${groupMetadata.subject}` : '';
        logger.info(`${inType} dari ${from}${groupName}: ${message.body}`);
    }

    if (await handleGame(sock, message)) return;

    await handleAntiLink(sock, message, groupMetadata);

    const mentionedJids = message.msg?.contextInfo?.mentionedJid || [];
    const quotedUserJid = message.msg?.contextInfo?.participant;
    const jidsToCheck = [...new Set([...mentionedJids, quotedUserJid].filter(Boolean))];
    
    const afkData = db.get('afk');

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
    const isOwner = message.sender === ownerJid;

    if (!config.isPublic && !isOwner) {
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
            await plugin.run(sock, message, args, { activeGames, groupMetadata });
        } catch (e) {
            logger.error(`Error saat menjalankan plugin ${command}:`, e);
            message.reply(`Terjadi kesalahan: ${e.message}`);
        }
    }
};

module.exports = handler;