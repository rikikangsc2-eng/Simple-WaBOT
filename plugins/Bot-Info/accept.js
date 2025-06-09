const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '../../database/users.json');

module.exports = {
  command: 'accept',
  description: 'Menyetujui syarat dan ketentuan untuk menggunakan fitur bot.',
  run: async (sock, message, args) => {
    let usersData = {};
    try { usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8')); } catch {}
    
    if (usersData[message.sender] && usersData[message.sender].accepted) {
      return message.reply('Anda sudah menyetujui syarat dan ketentuan sebelumnya.');
    }
    
    if (!usersData[message.sender]) {
      usersData[message.sender] = { money: 1000 };
    }
    
    usersData[message.sender].accepted = true;
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
    
    await message.reply('✅ Terima kasih! Anda telah menyetujui syarat dan ketentuan. Sekarang Anda dapat menggunakan semua fitur bot, termasuk sistem ekonomi.');
  }
};