// PATH: /lib/database.js
const { MongoClient } = require('mongodb');
const config = require('../config');
const logger = require('./logger');

const MONGO_URI = "mongodb+srv://puruproject:puru@cluster0.tolnaqa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = config.mongoDbName;
const BOT_DATA_COLLECTION = 'bot_data';

const JID_KEY_COLLECTIONS = ['users', 'cooldowns', 'afk', 'groupSettings'];
const inMemoryDb = {};
let client;
let db;

const collectionSchemas = {
    users: {
        balance: 0,
        name: 'Unknown User',
        gold: 0,
        iron: 0,
        bara: 0,
        baja: 0,
        pedanglegendaris: 0
    }
};

function encodeKey(key) {
    return key.replace(/\./g, '_dot_').replace(/@/g, '_at_');
}

function decodeKey(key) {
    return key.replace(/_dot_/g, '.').replace(/_at_/g, '@');
}

function transformObjectKeys(obj, transformFn) {
    const newObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[transformFn(key)] = obj[key];
        }
    }
    return newObj;
}

async function connectToDB() {
    if (db) return;
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        logger.info(`Terhubung ke MongoDB Atlas. Database: ${DB_NAME}`);
        
        logger.info('Memuat dan memvalidasi data ke dalam cache memori...');
        const collectionsToLoad = ['users', 'cooldowns', 'market', 'groupSettings', 'afk'];
        
        for (const collectionName of collectionsToLoad) {
            let doc = await db.collection(BOT_DATA_COLLECTION).findOne({ _id: collectionName });
            
            if (doc) {
                delete doc._id;
                if (JID_KEY_COLLECTIONS.includes(collectionName)) {
                    doc = transformObjectKeys(doc, decodeKey);
                }

                const schema = collectionSchemas[collectionName];
                if (schema) {
                    const validatedDoc = {};
                    let invalidCount = 0;
                    for (const key in doc) {
                        const entry = doc[key];
                        if (typeof entry !== 'object' || entry === null || Object.keys(entry).length === 0) {
                            invalidCount++;
                            continue;
                        }
                        validatedDoc[key] = { ...schema, ...entry };
                    }
                    if (invalidCount > 0) {
                       logger.warn(`[VALIDASI DB] Melewati ${invalidCount} entri kosong/tidak valid di koleksi '${collectionName}'.`);
                    }
                    inMemoryDb[collectionName] = validatedDoc;
                } else {
                    inMemoryDb[collectionName] = doc;
                }
            } else {
                inMemoryDb[collectionName] = {};
            }
        }
        
        logger.info('Semua data berhasil dimuat dan divalidasi ke cache.');

    } catch (e) {
        logger.error('Gagal terhubung atau memuat cache dari MongoDB:', e);
        process.exit(1);
    }
}

function get(collectionName) {
    return inMemoryDb[collectionName] || {};
}

function save(collectionName, data) {
    if (data === undefined || data === null) return;
    
    inMemoryDb[collectionName] = data;

    try {
        let dataToSave = data;
        if (JID_KEY_COLLECTIONS.includes(collectionName)) {
            dataToSave = transformObjectKeys(data, encodeKey);
        }

        const sanitizedData = JSON.parse(JSON.stringify(dataToSave));
        
        db.collection(BOT_DATA_COLLECTION).updateOne(
            { _id: collectionName },
            { $set: sanitizedData },
            { upsert: true }
        ).catch(e => logger.error(`Gagal menyimpan data (background) ke koleksi '${collectionName}': ${e.message}`));

    } catch (e) {
        logger.error(`Gagal melakukan sanitasi data untuk koleksi '${collectionName}':`, e);
    }
}

module.exports = { connectToDB, get, save };