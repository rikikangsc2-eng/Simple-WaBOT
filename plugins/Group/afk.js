const fs = require('fs');
const path = require('path');

module.exports = {
  command: 'afk',
  description: 'Mengatur status AFK (Away From Keyboard).',
  run: async (sock, message, args) => {
    const userJid = message.sender;
    const reason = args.join(' ') || 'Tanpa alasan';
    const time = Date.now();
    
    const dbPath = path.join(__dirname, '../../database/afk.json');
    
    let afkData = {};
    try {
      const fileData = fs.readFileSync(dbPath, 'utf8');
      afkData = JSON.parse(fileData);
    } catch (e) {
      console.log("Membuat file afk.json baru.");
    }
    
    afkData[userJid] = { reason, time };
    
    fs.writeFileSync(dbPath, JSON.stringify(afkData, null, 2));
    
    const afkMessage = `✅ *Anda sekarang AFK*\n\n*Alasan:* ${reason}`;
    await message.reply(afkMessage);
  }
};