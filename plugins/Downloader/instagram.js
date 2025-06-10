const axios = require('axios');

module.exports = {
  command: ['instagram', 'ig'],
  description: 'Mengunduh video atau gambar dari Instagram.',
  run: async (sock, message, args) => {
    if (!args[0] || !args[0].includes('instagram.com')) {
      return message.reply('Gunakan format: *.ig <URL Instagram>*');
    }
    
    try {
      await sock.sendMessage(message.from, { react: { text: '🔄', key: message.key } });
      
      const url = args[0];
      const apiUrl = `https://nirkyy-dev.hf.space/api/v1/allvid?url=${encodeURIComponent(url)}`;
      
      const response = await axios.get(apiUrl);
      const result = response.data;
      
      if (result && result.success && result.data && result.data.length > 0) {
        const data = result.data[0];
        const caption = data.title || 'Instagram Post';
        let downloadUrl;
        
        if (data.video_file_url) {
          downloadUrl = data.video_file_url;
        } else if (data.image) {
          downloadUrl = data.image;
        } else {
          await sock.sendMessage(message.from, { react: { text: '❌', key: message.key } });
          return message.reply('Gagal menemukan link unduhan media dari postingan ini.');
        }
        
        await message.media(caption, downloadUrl);
        await sock.sendMessage(message.from, { react: { text: '✅', key: message.key } });
        
      } else {
        await sock.sendMessage(message.from, { react: { text: '❌', key: message.key } });
        return message.reply(result.message || 'Gagal mendapatkan data dari URL tersebut. Pastikan URL valid dan publik.');
      }
    } catch (e) {
      console.error('Error pada plugin Instagram:', e);
      await sock.sendMessage(message.from, { react: { text: '❌', key: message.key } });
      await message.reply('Terjadi kesalahan. API mungkin sedang bermasalah atau URL tidak valid.');
    }
  }
};