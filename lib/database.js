const fs = require('fs');
const path = require('path');

const dbDirectory = path.join(__dirname, '../database');
const cache = {};

if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory);
}

function loadDatabase() {
  const files = fs.readdirSync(dbDirectory);
  for (const file of files) {
    if (path.extname(file) === '.json') {
      const filePath = path.join(dbDirectory, file);
      const fileName = path.basename(file, '.json');
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        cache[fileName] = JSON.parse(data);
      } catch (e) {
        console.error(`Gagal memuat database ${file}:`, e);
        cache[fileName] = {};
      }
    }
  }
  console.log('Semua database telah dimuat ke cache.');
}

function get(dbName) {
  if (cache[dbName] === undefined) {
    const filePath = path.join(dbDirectory, `${dbName}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      cache[dbName] = JSON.parse(data);
    } else {
      cache[dbName] = {};
    }
  }
  return cache[dbName];
}

function save(dbName, data) {
  if (!data) return;
  cache[dbName] = data;
  const filePath = path.join(dbDirectory, `${dbName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

loadDatabase();

module.exports = { get, save };