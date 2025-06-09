const axios = require('axios');
const fs = require('fs');
const path = require('path');

const gameSessionsPath = path.join(__dirname, '../../database/gameSessions.json');
const activeTimeouts = {};

function getGameSessions() {
  try { return JSON.parse(fs.readFileSync(gameSessionsPath, 'utf8')); }
  catch { return {}; }
}

function saveGameSessions(data) {
  fs.writeFileSync(gameSessionsPath, JSON.stringify(data, null, 2));
}

function loadActiveTimeouts(sock) {
  const sessions = getGameSessions();
  for (const jid in sessions) {
    if (sessions[jid]) {
      const session = sessions[jid];
      const timePassed = Date.now() - session.startTime;
      const timeLeft = 60000 - timePassed;
      
      if (timeLeft > 0) {
        activeTimeouts[jid] = setTimeout(() => {
          sock.sendMessage(jid, { text: `Waktu habis! Jawaban yang benar adalah *${session.answer}*.` });
          delete sessions[jid];
          saveGameSessions(sessions);
          delete activeTimeouts[jid];
        }, timeLeft);
      } else {
        delete sessions[jid];
        saveGameSessions(sessions);
      }
    }
  }
}

module.exports = {
  command: 'susunkata',
  description: 'Bermain game susun kata.',
  init: loadActiveTimeouts,
  run: async (sock, message, args) => {
    if (!message.isGroup) return message.reply('Game hanya bisa dimainkan di dalam grup.');
    
    let sessions = getGameSessions();
    if (sessions[message.from]) {
      return message.reply(`Masih ada sesi game yang belum selesai di grup ini!\n\nSoal: *${sessions[message.from].question}*\nKetik jawabannya langsung untuk menjawab.`);
    }
    
    try {
      const response = await axios.get('https://raw.githubusercontent.com/BochilTeam/database/refs/heads/master/games/susunkata.json');
      const data = response.data;
      
      if (!Array.isArray(data) || data.length === 0) {
        return message.reply('Gagal memulai game, format data soal tidak valid.');
      }
      
      const randomIndex = Math.floor(Math.random() * data.length);
      const gameData = data[randomIndex];
      
      sessions[message.from] = {
        game: 'susunkata',
        question: gameData.soal,
        answer: gameData.jawaban,
        clue: gameData.tipe,
        reward: Math.floor(Math.random() * 500) + 500,
        startTime: Date.now()
      };
      
      const gameMessage = `🔠 *Game Susun Kata* 🔠\n\nSusun kata berikut:\n*${gameData.soal}*\n\nTipe: *${gameData.tipe}*\nHadiah: *Rp ${sessions[message.from].reward}*`;
      await message.reply(gameMessage);
      
      activeTimeouts[message.from] = setTimeout(() => {
        if (sessions[message.from]) {
          sock.sendMessage(message.from, { text: `Waktu habis! Jawaban yang benar adalah *${gameData.jawaban}*.` });
          delete sessions[message.from];
          saveGameSessions(sessions);
          delete activeTimeouts[message.from];
        }
      }, 60000);
      
      saveGameSessions(sessions);
      
    } catch (e) {
      console.error('Error fetching susunkata data:', e);
      message.reply('Gagal memulai game, tidak dapat mengambil data soal.');
    }
  }
};