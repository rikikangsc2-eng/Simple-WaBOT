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

module.exports = { connectDB, getDb };