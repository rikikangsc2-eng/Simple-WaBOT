const { MongoClient } = require('mongodb');
const config = require('../config');
const logger = require('./logger');

const MONGO_URI = "mongodb+srv://puruproject:puru@cluster0.tolnaqa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = config.mongoDbName;
const BOT_DATA_COLLECTION = 'bot_data';

const JID_KEY_COLLECTIONS = ['users', 'cooldowns', 'afk'];

let client;
let db;
const inMemoryDb = {};

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
        
        logger.info('Memuat semua data ke dalam cache memori...');
        const collectionsToLoad = ['users', 'cooldowns', 'market', 'groupSettings', 'afk'];
        
        for (const collectionName of collectionsToLoad) {
            let doc = await db.collection(BOT_DATA_COLLECTION).findOne({ _id: collectionName });
            
            if (doc) {
                delete doc._id;
                if (JID_KEY_COLLECTIONS.includes(collectionName)) {
                    doc = transformObjectKeys(doc, decodeKey);
                }
                inMemoryDb[collectionName] = doc;
            } else {
                inMemoryDb[collectionName] = {};
            }
        }
        
        logger.info('Semua data berhasil dimuat ke cache.');

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