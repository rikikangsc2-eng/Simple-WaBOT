const db = require('../../lib/database');

const pendingBombGames = new Map();

const generateBoard = (boxes) => {
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

module.exports = {
    command: 'tebakbom',
    description: 'Bermain tebak bom dengan taruhan melawan pemain lain.',
    category: 'Game',
    run: async (sock, message, args, { activeBombGames }) => {
        const senderJid = message.sender;
        const groupJid = message.from;
        const action = args[0]?.toLowerCase();

        if (activeBombGames.has(groupJid)) {
            return message.reply('Sudah ada permainan yang sedang berlangsung di grup ini.');
        }

        if (['terima', 'tolak'].includes(action)) {
            const challengeKey = `${groupJid}:${senderJid}`;
            const challenge = pendingBombGames.get(challengeKey);

            if (!challenge) {
                return message.reply('Tidak ada tantangan tebak bom untukmu saat ini.');
            }

            clearTimeout(challenge.timeout);
            pendingBombGames.delete(challengeKey);
            const { challengerJid, amount } = challenge;

            if (action === 'tolak') {
                return sock.sendMessage(groupJid, { text: `@${senderJid.split('@')[0]} telah menolak tantangan tebak bom dari @${challengerJid.split('@')[0]}.`, mentions: [senderJid, challengerJid] });
            }

            if (action === 'terima') {
                let usersDb = db.get('users');
                const challengerBalance = usersDb[challengerJid]?.balance || 0;
                const targetBalance = usersDb[senderJid]?.balance || 0;

                if (challengerBalance < amount || targetBalance < amount) {
                    return message.reply('Salah satu pemain tidak memiliki cukup uang untuk taruhan. Permainan dibatalkan.');
                }

                const firstTurnJid = Math.random() < 0.5 ? challengerJid : senderJid;
                const boxes = Array.from({ length: 9 }, (_, i) => numberToEmoji(i));
                
                const bombIndexes = [];
                while (bombIndexes.length < 2) {
                    const bomb = Math.floor(Math.random() * 9);
                    if (!bombIndexes.includes(bomb)) {
                        bombIndexes.push(bomb);
                    }
                }

                const initialText = `*TEBAK BOM DIMULAI* 💣\n` +
                    `Taruhan: *Rp ${amount.toLocaleString()}*\n\n` +
                    generateBoard(boxes) +
                    `\nGiliran pertama adalah @${firstTurnJid.split('@')[0]}.\n\n` +
                    `_Balas pesan ini dengan nomor kotak._`;

                const initialMsg = await sock.sendMessage(groupJid, { text: initialText, mentions: [firstTurnJid] });

                activeBombGames.set(groupJid, {
                    challengerJid,
                    targetJid: senderJid,
                    amount,
                    turn: firstTurnJid,
                    bombIndexes,
                    boxes,
                    messageID: initialMsg.key.id
                });
            }
            return;
        }

        const targetJid = message.msg?.contextInfo?.mentionedJid?.[0];
        const amount = parseInt(args[1]);

        if (!targetJid || isNaN(amount) || amount <= 0) {
            return message.reply('Gunakan format: *.tebakbom @user <jumlah_taruhan>*\nContoh: .tebakbom @user 1000');
        }
        if (targetJid === senderJid) {
            return message.reply('Anda tidak bisa menantang diri sendiri!');
        }
        if (pendingBombGames.has(`${groupJid}:${targetJid}`) || activeBombGames.has(groupJid)) {
            return message.reply('Sudah ada tantangan atau permainan yang aktif di grup ini. Harap tunggu selesai.');
        }

        let usersDb = db.get('users');
        const challengerBalance = usersDb[senderJid]?.balance || 0;
        const targetBalance = usersDb[targetJid]?.balance || 0;

        if (challengerBalance < amount || targetBalance < amount) {
            return message.reply('Saldo Anda atau saldo target tidak cukup untuk taruhan ini.');
        }

        const challengeKey = `${groupJid}:${targetJid}`;
        const timeout = setTimeout(() => {
            if (pendingBombGames.has(challengeKey)) {
                pendingBombGames.delete(challengeKey);
                sock.sendMessage(groupJid, { text: `Tantangan tebak bom dari @${senderJid.split('@')[0]} untuk @${targetJid.split('@')[0]} telah kedaluwarsa.`, mentions: [senderJid, targetJid] });
            }
        }, 60 * 1000);

        pendingBombGames.set(challengeKey, { challengerJid: senderJid, amount, timeout });
        await sock.sendMessage(groupJid, { text: `💣 *TANTANGAN TEBAK BOM* 💣\n\n@${senderJid.split('@')[0]} menantang @${targetJid.split('@')[0]} untuk bermain tebak bom dengan taruhan *Rp ${amount.toLocaleString()}*!\n\nKetik *.tebakbom terima* atau *.tebakbom tolak*. Waktu 60 detik.`, mentions: [senderJid, targetJid] });
    }
};