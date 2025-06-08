const fs = require('fs');
const path = require('path');

const usersDbPath = path.join(__dirname, '../../database/users.json');

function getUserData() {
  try { return JSON.parse(fs.readFileSync(usersDbPath, 'utf8')); }
  catch { return {}; }
}

function saveUserData(data) {
  fs.writeFileSync(usersDbPath, JSON.stringify(data, null, 2));
}

module.exports = {
  command: 'investasi',
  description: 'Menginvestasikan sejumlah uang untuk potensi keuntungan.',
  run: async (sock, message, args) => {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply('Gunakan format: *.investasi <jumlah>*\nContoh: .investasi 1000');
    }
    
    const users = getUserData();
    const userJid = message.sender;
    
    if (!users[userJid] || users[userJid].money < amount) {
      return message.reply('Uang Anda tidak cukup untuk berinvestasi sejumlah itu.');
    }
    
    users[userJid].money -= amount;
    
    const profit = Math.floor(Math.random() * (amount * 0.5) - (amount * 0.2)); // -20% to +50%
    const finalAmount = amount + profit;
    
    let replyText = '';
    if (profit > 0) {
      replyText = `📈 *Investasi Berhasil!*\n\nAnda menginvestasikan *Rp ${amount.toLocaleString()}* dan mendapatkan keuntungan *Rp ${profit.toLocaleString()}*.\nTotal kembali: *Rp ${finalAmount.toLocaleString()}*`;
    } else {
      replyText = `📉 *Investasi Gagal!*\n\nAnda menginvestasikan *Rp ${amount.toLocaleString()}* dan merugi *Rp ${Math.abs(profit).toLocaleString()}*.\nTotal kembali: *Rp ${finalAmount.toLocaleString()}*`;
    }
    
    users[userJid].money += finalAmount;
    saveUserData(users);
    
    await message.reply(replyText);
  }
};