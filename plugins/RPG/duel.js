const db = require('../../lib/database');

const pendingDuels = new Map();

const equipmentPower = {
    emas: 0.1,
    iron: 0.05,
    bara: 0.02,
    baja: 15,
    pedanglegendaris: 100,
};

function calculatePower(user) {
    if (!user) return 1;
    let power = 1;
    for (const item in equipmentPower) {
        power += (user[item] || 0) * equipmentPower[item];
    }
    return Math.round(power);
}

function createHealthBar(hp) {
    const totalBars = 10;
    const filledBars = Math.round((hp / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return `[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}] ${hp}/100`;
}

async function runDuelAnimation(sock, initialMessage, p1, p2, amount) {
    const p1Jid = p1.jid;
    const p2Jid = p2.jid;
    const mentions = [p1Jid, p2Jid];
    const p1Power = calculatePower(p1.data);
    const p2Power = calculatePower(p2.data);
    
    const attackPhrases = [
        "melemparkan sendal jepit legendaris", "menggunakan jurus 'Pukulan Seribu Bayangan'", "menyerang sambil teriak 'WIBUUU!'",
        "menggelitik lawan hingga tak berdaya", "mengeluarkan tatapan sinis yang menyakitkan", "melempar batu kerikil dengan presisi tinggi",
        "menggunakan 'Senggolan Maut'"
    ];
    const defensePhrases = [
        "menangkis serangan dengan tutup panci", "menghindar sambil joget TikTok", "tiba-tiba pura-pura AFK",
        "menggunakan tameng 'Sabar Ini Ujian'", "membangun benteng dari bantal guling", "berubah menjadi batu untuk sesaat",
        "berhasil menghindar tipis"
    ];

    let p1HP = 100;
    let p2HP = 100;

    const header = `🔥 *DUEL DIMULAI* 🔥\nTaruhan: *Rp ${amount.toLocaleString()}*\n`;

    const editMessage = async (text) => {
        try {
            await sock.sendMessage(initialMessage.from, { text, mentions, edit: initialMessage.key });
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
            console.error("Gagal mengedit pesan:", e);
        }
    };
    
    let actionMessage = "Para petarung saling menatap tajam, bersiap untuk ronde pertama!";

    while (p1HP > 0 && p2HP > 0) {
        const isP1Attacking = Math.random() < 0.5;
        const attackerJid = isP1Attacking ? p1Jid : p2Jid;
        const defenderJid = isP1Attacking ? p2Jid : p1Jid;
        const attackerPower = isP1Attacking ? p1Power : p2Power;

        const baseDamage = Math.floor(Math.random() * 20) + 10;
        const equipmentBonus = Math.round(attackerPower / 5);
        const damage = baseDamage + equipmentBonus;
        
        const attackDesc = attackPhrases[Math.floor(Math.random() * attackPhrases.length)];
        const defenseDesc = defensePhrases[Math.floor(Math.random() * defensePhrases.length)];
        
        actionMessage = `💥 @${attackerJid.split('@')[0]} ${attackDesc}, namun @${defenderJid.split('@')[0]} ${defenseDesc}! Tetap terkena *${damage}* kerusakan!`;

        if (isP1Attacking) {
            p2HP -= damage;
        } else {
            p1HP -= damage;
        }
        p1HP = Math.max(0, p1HP);
        p2HP = Math.max(0, p2HP);

        const hpDisplay = `*@${p1Jid.split('@')[0]}:* ${createHealthBar(p1HP)}\n` +
                          `*@${p2Jid.split('@')[0]}:* ${createHealthBar(p2HP)}`;

        await editMessage(`${header}\n${hpDisplay}\n\n${actionMessage}`);
        
        if (p1HP <= 0 || p2HP <= 0) break;
    }

    const finalWinnerJid = p1HP > 0 ? p1Jid : p2Jid;
    const finalLoserJid = p1HP > 0 ? p2Jid : p1Jid;

    const hpDisplay = `*@${p1Jid.split('@')[0]}:* ${createHealthBar(p1HP)}\n` +
                      `*@${p2Jid.split('@')[0]}:* ${createHealthBar(p2HP)}`;
    actionMessage = `🏆 *DUEL SELESAI!* Pemenangnya adalah @${finalWinnerJid.split('@')[0]}!`;
    
    let usersDb = db.get('users');
    usersDb[finalWinnerJid].balance += amount;
    usersDb[finalLoserJid].balance -= amount;
    db.save('users', usersDb);

    await editMessage(`${header}\n${hpDisplay}\n\n${actionMessage}`);
}

module.exports = {
    command: 'duel',
    description: 'Menantang pemain lain untuk berduel dengan taruhan.',
    category: 'Ekonomi',
    run: async (sock, message, args) => {
        const senderJid = message.sender;
        const action = args[0]?.toLowerCase();

        if (['terima', 'tolak'].includes(action)) {
            const duelKey = `${message.from}:${senderJid}`;
            const duelRequest = pendingDuels.get(duelKey);

            if (!duelRequest) {
                return message.reply('Tidak ada tantangan duel yang ditujukan untukmu saat ini.');
            }

            clearTimeout(duelRequest.timeout);
            pendingDuels.delete(duelKey);
            const { challengerJid, amount } = duelRequest;

            if (action === 'tolak') {
                return sock.sendMessage(message.from, { text: `@${senderJid.split('@')[0]} telah menolak tantangan duel dari @${challengerJid.split('@')[0]}.`, mentions: [senderJid, challengerJid] });
            }

            if (action === 'terima') {
                let usersDb = db.get('users');
                const challenger = { jid: challengerJid, data: usersDb[challengerJid] };
                const target = { jid: senderJid, data: usersDb[senderJid] };

                if ((challenger.data?.balance || 0) < amount || (target.data?.balance || 0) < amount) {
                    return message.reply('Salah satu pemain tidak memiliki cukup uang untuk taruhan ini lagi. Duel dibatalkan.');
                }

                const initialMsg = await sock.sendMessage(message.from, { text: 'Duel diterima! Mempersiapkan arena...', mentions: [challenger.jid, target.jid] });
                await runDuelAnimation(sock, { ...initialMsg, from: message.from }, challenger, target, amount);
            }
            return;
        }

        const targetJid = message.msg?.contextInfo?.mentionedJid?.[0];
        const amount = parseInt(args[1]);

        if (!targetJid || isNaN(amount) || amount <= 0) {
            return message.reply('Gunakan format: *.duel @target <jumlah_taruhan>*\nContoh: .duel @user 5000');
        }

        if (targetJid === senderJid) {
            return message.reply('Anda tidak bisa berduel dengan diri sendiri!');
        }
        
        if (pendingDuels.has(`${message.from}:${targetJid}`)) {
            return message.reply('Pemain tersebut sudah memiliki tantangan duel yang aktif. Tunggu hingga selesai.');
        }

        let usersDb = db.get('users');
        const challengerBalance = usersDb[senderJid]?.balance || 0;
        const targetBalance = usersDb[targetJid]?.balance || 0;

        if (challengerBalance < amount || targetBalance < amount) {
            return message.reply('Saldo Anda atau target tidak cukup untuk taruhan ini.');
        }

        const duelKey = `${message.from}:${targetJid}`;
        const timeout = setTimeout(() => {
            if (pendingDuels.has(duelKey)) {
                pendingDuels.delete(duelKey);
                sock.sendMessage(message.from, { text: `Tantangan duel dari @${senderJid.split('@')[0]} untuk @${targetJid.split('@')[0]} telah kedaluwarsa.`, mentions: [senderJid, targetJid] });
            }
        }, 60 * 1000);

        pendingDuels.set(duelKey, { challengerJid: senderJid, amount, timeout });
        
        await sock.sendMessage(message.from, { text: `⚔️ *TANTANGAN DUEL* ⚔️\n\n@${senderJid.split('@')[0]} menantang @${targetJid.split('@')[0]} untuk berduel dengan taruhan *Rp ${amount.toLocaleString()}*!\n\nKetik *.duel terima* untuk menerima atau *.duel tolak* untuk menolak. Waktu 60 detik.`, mentions: [senderJid, targetJid] });
    }
};