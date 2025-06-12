const config = require('./config');
const { serialize } = require('./lib/serialize');
const db = require('./lib/database');
const logger = require('./lib/logger');
const { plugins } = require('./lib/pluginManager');

const activeGames = new Map();
const activeBombGames = new Map();

const generateBombBoard = (boxes) => {
    let board = '';
    for (let i = 0; i < boxes.length; i++) {
        board += boxes[i];
        if ((i + 1) % 3 === 0) {
            board += '\n';
        } else {
            board += ' ';
        }
    }
    return board;
};

const numberToEmoji = (n) => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    return emojis[n] || `${n+1}️⃣`;
};

async function handleBombGame(sock, message) {
    if (!message.isGroup || !message.msg?.contextInfo?.quotedMessage) return false;

    const game = activeBombGames.get(message.from);
    if (!game || message.msg.contextInfo.stanzaId !== game.messageID) return false;
    
    if (message.sender !== game.turn) {
        return true; 
    }

    const choice = parseInt(message.body.trim()) - 1;
    if (isNaN(choice) || choice < 0 || choice > 8) return true;

    if (game.boxes[choice] !== numberToEmoji(choice)) {
        message.reply('Kotak itu sudah dibuka, pilih yang lain!');
        return true;
    }

    let usersDb = db.get('users');
    if (game.bombIndexes.includes(choice)) {
        const winnerJid = (message.sender === game.challengerJid) ? game.targetJid : game.challengerJid;
        const loserJid = message.sender;

        usersDb[winnerJid].balance += game.amount;
        usersDb[loserJid].balance -= game.amount;
        db.save('users', usersDb);

        game.boxes[choice] = '💣';

        const endText = `*KABOOM!* 💣💥\n\n` +
            `@${loserJid.split('@')[0]} menginjak bom!\n` +
            `Pemenangnya adalah @${winnerJid.split('@')[0]} dan mendapatkan *Rp ${game.amount.toLocaleString()}*!\n\n` +
            generateBombBoard(game.boxes);

        await sock.sendMessage(message.from, { text: endText, mentions: [winnerJid, loserJid] });
        activeBombGames.delete(message.from);
    } else {
        game.boxes[choice] = '✅';
        game.turn = (message.sender === game.challengerJid) ? game.targetJid : game.challengerJid;
        
        const turnText = `*TEBAK BOM* 💣\n` +
            `Taruhan: *Rp ${game.amount.toLocaleString()}*\n\n` +
            generateBombBoard(game.boxes) +
            `\nGiliran @${game.turn.split('@')[0]} untuk memilih kotak.\n\n` +
            `_Balas pesan ini dengan nomor kotak._`;

        const newMsg = await sock.sendMessage(message.from, { text: turnText, mentions: [game.turn] });
        game.messageID = newMsg.key.id;
        activeBombGames.set(message.from, game);
    }
    
    return true;
}

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

const handler = async (sock, m, options) => {
    if (!m) return;
    const message = await serialize(sock, m);

    let groupMetadata = null;
    if (message.isGroup) {
        groupMetadata = await sock.groupMetadata(message.from);
    }

    if (message.body) {
        const from = message.pushName;
        const inType = message.isGroup ? 'Grup' : 'Pribadi';
        const groupName = message.isGroup ? ` di ${groupMetadata.subject}` : '';
        logger.info(`${inType} dari ${from}${groupName}: ${message.body}`);
    }

    if (await handleBombGame(sock, message)) return;
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
            await plugin.run(sock, message, args, { activeGames, groupMetadata, activeBombGames });
        } catch (e) {
            logger.error(`Error saat menjalankan plugin ${command}:`, e);
            message.reply(`Terjadi kesalahan: ${e.message}`);
        }
    }
};

module.exports = handler;