const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const dbDirectory = path.join(__dirname, '../database');
if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
}

function getDBPath(dbName) {
    return path.join(dbDirectory, `${dbName}.json`);
}

function get(dbName) {
    const filePath = getDBPath(dbName);
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (e) {
        logger.error(`Gagal memuat atau mem-parse database ${dbName}:`, e);
        fs.writeFileSync(filePath, JSON.stringify({}));
        return {};
    }
}

function save(dbName, data) {
    if (data === undefined || data === null) return;
    const filePath = getDBPath(dbName);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        logger.error(`Gagal menyimpan database ${dbName}:`, e);
    }
}

module.exports = { get, save };