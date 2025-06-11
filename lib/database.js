const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { LRUCache } = require('lru-cache');

const dbDirectory = path.join(__dirname, '../database');
if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
}

const dbCache = new LRUCache({ max: 5 });

function getDBPath(dbName) {
    return path.join(dbDirectory, `${dbName}.json`);
}

function get(dbName) {
    if (dbCache.has(dbName)) {
        return dbCache.get(dbName);
    }

    const filePath = getDBPath(dbName);
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(data);
            dbCache.set(dbName, parsedData);
            return parsedData;
        }
        const emptyData = {};
        dbCache.set(dbName, emptyData);
        return emptyData;
    } catch (e) {
        logger.error(`Gagal memuat atau mem-parse database ${dbName}:`, e);
        fs.writeFileSync(filePath, JSON.stringify({}));
        const errorData = {};
        dbCache.set(dbName, errorData);
        return errorData;
    }
}

function save(dbName, data) {
    if (data === undefined || data === null) return;
    const filePath = getDBPath(dbName);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        dbCache.set(dbName, data);
    } catch (e) {
        logger.error(`Gagal menyimpan database ${dbName}:`, e);
    }
}

module.exports = { get, save };