const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../database/groupSettings.json');

function getGroupSettings() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveGroupSettings(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = {
  command: 'antilink',
  description: 'Mengaktifkan atau menonaktifkan fitur anti link WhatsApp.',
  run: async (sock, message, args) => {
    if (!message.isGroup) return message.reply('Perintah ini hanya bisa digunakan di dalam grup.');
    
    const groupMeta = await sock.groupMetadata(message.from);
    const sender = groupMeta.participants.find(p => p.id === message.sender);
    const isAdmin = sender && (sender.admin === 'admin' || sender.admin === 'superadmin');
    
    if (!isAdmin) return message.reply('Hanya admin grup yang bisa menggunakan perintah ini.');
    
    const option = args[0]?.toLowerCase();
    if (option !== 'on' && option !== 'off') {
      return message.reply('Gunakan format: *.antilink on* atau *.antilink off*');
    }
    
    const settings = getGroupSettings();
    if (!settings[message.from]) {
      settings[message.from] = {};
    }
    
    settings[message.from].isAntilinkEnabled = (option === 'on');
    saveGroupSettings(settings);
    
    await message.reply(`Fitur anti link WhatsApp telah *${option === 'on' ? 'diaktifkan' : 'dinonaktifkan'}* untuk grup ini.`);
  }
};