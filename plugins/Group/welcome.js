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
  command: 'welcome',
  description: 'Mengaktifkan atau menonaktifkan pesan selamat datang.',
  run: async (sock, message, args) => {
    if (!message.isGroup) return message.reply('Perintah ini hanya bisa digunakan di dalam grup.');
    
    const groupMeta = await sock.groupMetadata(message.from);
    const sender = groupMeta.participants.find(p => p.id === message.sender);
    const isAdmin = sender && (sender.admin === 'admin' || sender.admin === 'superadmin');
    
    if (!isAdmin) return message.reply('Hanya admin grup yang bisa menggunakan perintah ini.');
    
    const option = args[0]?.toLowerCase();
    if (option !== 'on' && option !== 'off') {
      return message.reply('Gunakan format: *.welcome on* atau *.welcome off*');
    }
    
    const settings = getGroupSettings();
    if (!settings[message.from]) {
      settings[message.from] = { welcomeMessage: 'Selamat datang @user di grup $group!' };
    }
    
    settings[message.from].isWelcomeEnabled = (option === 'on');
    saveGroupSettings(settings);
    
    await message.reply(`Pesan selamat datang telah *${option === 'on' ? 'diaktifkan' : 'dinonaktifkan'}* untuk grup ini.`);
  }
};