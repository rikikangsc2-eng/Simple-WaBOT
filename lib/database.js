const { MongoClient } = require('mongodb');
const config = require('../config');
const logger = require('./logger');

const MONGO_URI = "mongodb+srv://puruproject:puru@cluster0.tolnaqa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = config.mongoDbName;
const BOT_DATA_COLLECTION = 'bot_data';

const JID_KEY_COLLECTIONS = ['users', 'cooldowns', 'afk', 'groupSettings'];
const USER_JID_ONLY_COLLECTIONS = ['users', 'cooldowns', 'afk'];
const inMemoryDb = {};
let client;
let db;

const defaultDbState = {
    users: {},
    cooldowns: {},
    market: {
        emas_price: 75000,
        last_emas_price: 75000,
        iron_price: 25000,
        last_iron_price: 25000,
        bara_price: 15000,
        last_bara_price: 15000
    },
    groupSettings: {},
    afk: {}
};

const userSchema = {
    balance: 0,
    name: 'Unknown User',
    emas: 0,
    iron: 0,
    bara: 0,
    baja: 0,
    pedanglegendaris: 0
};

function encodeKey(key) {
    return key.replace(/\./g, '_dot_').replace(/@/g, '_at_');
}

function decodeKey(key) {
    return key.replace(/_dot_/g, '.').replace(/_at_/g, '@');
}

function transformObjectKeys(obj, transformFn) {
    if (!obj || typeof obj !== 'object') return {};
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
        
        logger.info('Memuat dan membersihkan data ke dalam cache memori...');
        
        for (const collectionName in defaultDbState) {
            const defaultData = defaultDbState[collectionName];
            let doc = await db.collection(BOT_DATA_COLLECTION).findOne({ _id: collectionName });

            let loadedData = doc ? (delete doc._id, doc) : {};

            if (JID_KEY_COLLECTIONS.includes(collectionName)) {
                loadedData = transformObjectKeys(loadedData, decodeKey);
            }
            
            if (collectionName === 'users') {
                const cleanedUsers = {};
                let removedCount = 0;
                for (const key in loadedData) {
                    const entry = loadedData[key];

                    if (typeof key !== 'string' || !key.endsWith('@s.whatsapp.net')) {
                        removedCount++;
                        continue;
                    }
                    if (typeof entry !== 'object' || entry === null || Object.keys(entry).length === 0) {
                        removedCount++;
                        continue; 
                    }
                    
                    cleanedUsers[key] = { ...userSchema, ...entry };
                }
                if (removedCount > 0) {
                   logger.warn(`[PEMBERSIHAN DB] Menghapus ${removedCount} entri tidak valid (grup/format salah) dari koleksi 'users'.`);
                }
                inMemoryDb[collectionName] = cleanedUsers;
            } else {
                inMemoryDb[collectionName] = { ...defaultData, ...loadedData };
            }
            
            await save(collectionName, inMemoryDb[collectionName]);
        }
        
        logger.info('Semua data berhasil dimuat dan dibersihkan.');

    } catch (e) {
        logger.error('Gagal terhubung atau memuat cache dari MongoDB:', e);
        process.exit(1);
    }
}

function get(collectionName) {
    return inMemoryDb[collectionName] || defaultDbState[collectionName] || {};
}

async function save(collectionName, data) {
    if (data === undefined || data === null) return;

    let dataToProcess = data;
    if (USER_JID_ONLY_COLLECTIONS.includes(collectionName)) {
        const filteredData = {};
        let invalidCount = 0;
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                if (typeof key === 'string' && key.endsWith('@s.whatsapp.net')) {
                    filteredData[key] = data[key];
                } else {
                    invalidCount++;
                }
            }
        }
        if (invalidCount > 0) {
            logger.warn(`[DB SAVE] Mencegah penyimpanan ${invalidCount} entri tidak valid di koleksi '${collectionName}'.`);
        }
        dataToProcess = filteredData;
    }
    
    inMemoryDb[collectionName] = dataToProcess;

    try {
        let dataToSave = { ...dataToProcess };
        if (JID_KEY_COLLECTIONS.includes(collectionName)) {
            dataToSave = transformObjectKeys(dataToSave, encodeKey);
        }

        const sanitizedData = JSON.parse(JSON.stringify(dataToSave));
        
        await db.collection(BOT_DATA_COLLECTION).updateOne(
            { _id: collectionName },
            { $set: sanitizedData },
            { upsert: true }
        );

    } catch (e) {
        logger.error(`Gagal melakukan sanitasi data untuk koleksi '${collectionName}':`, e);
    }
}

module.exports = { connectToDB, get, save };