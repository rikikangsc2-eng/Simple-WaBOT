const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const config = require('../../config');

function getAllJsFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      if (['node_modules', '.git', 'session'].includes(path.basename(fullPath))) {
        return;
      }
      getAllJsFiles(fullPath, arrayOfFiles);
    } else if (path.extname(file) === '.js') {
      arrayOfFiles.push(fullPath);
    }
  });
  
  return arrayOfFiles;
}

module.exports = {
  command: 'tozip',
  description: 'Mengarsipkan semua file .js bot ke dalam file zip (Owner only).',
  run: async (sock, message, args) => {
    const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
    if (message.sender !== ownerJid) {
      return message.reply('Perintah ini hanya untuk Owner.');
    }
    
    await message.reply('Mengumpulkan semua file .js dan membuat arsip...');
    
    try {
      const zip = new JSZip();
      const rootDir = path.join(__dirname, '..', '..');
      const jsFiles = getAllJsFiles(rootDir);
      
      if (jsFiles.length === 0) {
        return message.reply('Tidak ada file .js yang ditemukan untuk diarsipkan.');
      }
      
      for (const filePath of jsFiles) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath);
        zip.file(fileName, fileContent);
      }
      
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9
        }
      });
      
      await sock.sendMessage(
        message.from, {
          document: zipBuffer,
          mimetype: 'application/zip',
          fileName: 'anjay.zip',
          caption: `Berhasil mengarsipkan ${jsFiles.length} file .js`
        }, {
          quoted: message
        }
      );
      
    } catch (e) {
      console.error('Error pada plugin tozip:', e);
      await message.reply(`Gagal membuat arsip zip. Error: ${e.message}`);
    }
  }
};