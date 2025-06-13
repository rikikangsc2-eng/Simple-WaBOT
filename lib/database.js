const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('../config');
const { connectDB, getDb, cleanupUnknownCollections } = require('./mongoClient');

const dbDirectory = path.join(__dirname, '../database');
if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
}

async function init() {
    if (config.databaseType === 'cloud') {
        await connectDB();
    }
}

async function get(dbName) {
    if (config.databaseType === 'cloud') {
        const db = getDb();
        if (!db) throw new Error('Database cloud belum terhubung.');
        const collection = db.collection('data');
        const doc = await collection.findOne({ _id: dbName });
        return doc ? doc.data : {};
    } else {
        const filePath = path.join(dbDirectory, `${dbName}.json`);
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
            return {};
        } catch (e) {
            logger.error(`Gagal memuat atau mem-parse database lokal ${dbName}:`, e);
            fs.writeFileSync(filePath, JSON.stringify({}));
            return {};
        }
    }
}

async function save(dbName, data) {
    if (data === undefined || data === null) return;
    
    if (config.databaseType === 'cloud') {
        const db = getDb();
        if (!db) throw new Error('Database cloud belum terhubung.');
        const collection = db.collection('data');
        await collection.updateOne({ _id: dbName }, { $set: { data } }, { upsert: true });
    } else {
        const filePath = path.join(dbDirectory, `${dbName}.json`);
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (e) {
            logger.error(`Gagal menyimpan database lokal ${dbName}:`, e);
        }
    }
}

async function cleanup() {
    if (config.databaseType === 'cloud') {
        await cleanupUnknownCollections();
    }
}

module.exports = { init, get, save, cleanup };