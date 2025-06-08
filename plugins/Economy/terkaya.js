const fs = require('fs');
const path = require('path');
const config = require('../../config');

const dbPath = path.join(__dirname, '../../database/users.json');

module.exports = {
  command: 'terkaya',
  description: 'Menampilkan papan peringkat pengguna terkaya.',
  run: async (sock, message, args) => {
    let usersData = {};
    try { usersData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}
    
    const sortedUsers = Object.entries(usersData)
      .filter(([jid, data]) => data.money > 0)
      .sort(([, a], [, b]) => b.money - a.money)
      .slice(0, 10);
    
    if (sortedUsers.length === 0) {
      return message.reply('Belum ada pengguna kaya di database. Mainkan game untuk mendapatkan uang!');
    }
    
    let leaderboardText = '🏆 *Papan Peringkat Terkaya* 🏆\n\n';
    let mentions = [];
    
    for (let i = 0; i < sortedUsers.length; i++) {
      const [jid, data] = sortedUsers[i];
      const userNumber = jid.split('@')[0];
      leaderboardText += `${i + 1}. @${userNumber} - *Rp ${data.money.toLocaleString()}*\n`;
      mentions.push(jid);
    }
    
    await sock.sendMessage(message.from, { text: leaderboardText, mentions: mentions });
  }
};