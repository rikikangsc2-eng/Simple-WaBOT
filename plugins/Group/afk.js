const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../database/afk.json');

module.exports = {
  command: 'afk',
  description: 'Mengatur status AFK (Away From Keyboard) di grup ini.',
  run: async (sock, message, args) => {
    if (!message.isGroup) return message.reply('Perintah ini hanya bisa digunakan di dalam grup.');
    
    const userJid = message.sender;
    const groupId = message.from;
    const reason = args.join(' ') || 'Tanpa alasan';
    const time = Date.now();
    
    let afkData = {};
    try {
      afkData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
      console.log("Membuat file afk.json baru.");
    }
    
    if (!afkData[groupId]) {
      afkData[groupId] = {};
    }
    
    afkData[groupId][userJid] = { reason, time };
    
    fs.writeFileSync(dbPath, JSON.stringify(afkData, null, 2));
    
    const afkMessage = `✅ *Anda sekarang AFK di grup ini*\n\n*Alasan:* ${reason}`;
    await message.reply(afkMessage);
  }
};