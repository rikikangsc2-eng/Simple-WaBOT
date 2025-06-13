const { MongoClient } = require('mongodb');
const config = require('../config');
const logger = require('./logger');

let db;

async function connectDB() {
    if (db) return db;
    try {
        const client = new MongoClient(config.mongoURI);
        await client.connect();
        db = client.db();
        logger.info('Berhasil terhubung ke MongoDB.');
        return db;
    } catch (e) {
        logger.error('Gagal terhubung ke MongoDB:', e);
        process.exit(1);
    }
}

function getDb() {
    return db;
}

async function cleanupUnknownCollections() {
    if (!db) {
        logger.warn('Koneksi DB tidak ditemukan, melewati proses pembersihan.');
        return;
    }

    const whitelistedCollections = ['data'];
    logger.info(`Koleksi yang diizinkan (whitelist): [${whitelistedCollections.join(', ')}]`);

    try {
        const collections = await db.listCollections().toArray();
        for (const collection of collections) {
            if (!whitelistedCollections.includes(collection.name)) {
                logger.warn(`Koleksi asing '${collection.name}' ditemukan. Menghapus...`);
                await db.collection(collection.name).drop();
                logger.info(`Koleksi '${collection.name}' berhasil dihapus.`);
            }
        }
    } catch (e) {
        logger.error('Gagal melakukan pembersihan koleksi:', e);
    }
}

module.exports = { connectDB, getDb, cleanupUnknownCollections };