const fs = require('fs');
const path = require('path');

const dbDirectory = path.join(__dirname, '../database');
const cache = {};

if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
}

function get(dbName) {
    if (cache[dbName] === undefined) {
        const filePath = path.join(dbDirectory, `${dbName}.json`);
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                cache[dbName] = JSON.parse(data);
            } else {
                cache[dbName] = {};
            }
        } catch (e) {
            console.error(`Gagal memuat atau mem-parse database ${dbName}:`, e);
            cache[dbName] = {};
        }
    }
    return cache[dbName];
}

function save(dbName, data) {
    if (data === undefined || data === null) return;
    cache[dbName] = data;
    const filePath = path.join(dbDirectory, `${dbName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = { get, save };