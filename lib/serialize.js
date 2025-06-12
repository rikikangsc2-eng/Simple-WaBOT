const { proto, getContentType } = require('@whiskeysockets/baileys');
const { getBuffer } = require('./functions');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const fileType = require('file-type');
const config = require('../config');
const { isWhatsAppConnected, addToQueue } = require('./connectionManager');

exports.serialize = async (sock, m) => {
    if (!m) return m;
    
    let M = proto.WebMessageInfo;
    if (m.key) {
        m.id = m.key.id;
        m.isGroup = m.key.remoteJid.endsWith('@g.us');
        m.from = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.sender = m.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net' || sock.user.id) : (m.key.participant || m.key.remoteJid);
        m.pushName = m.pushName || 'User';
    }
    
    if (m.message) {
        m.type = getContentType(m.message);
        m.msg = (m.type === 'viewOnceMessage' ? m.message[m.type].message[getContentType(m.message[m.type].message)] : m.message[m.type]);
        
        m.body = m.message.conversation ||
            m.msg?.text ||
            m.msg?.caption ||
            (m.type === 'listResponseMessage' && m.msg?.singleSelectReply?.selectedRowId) ||
            (m.type === 'buttonsResponseMessage' && m.msg?.selectedButtonId) ||
            (m.type === 'templateButtonReplyMessage' && m.msg?.selectedId) ||
            '';
            
        const queueOrSendMessage = (jid, content, options = {}) => {
            if (isWhatsAppConnected()) {
                return sock.sendMessage(jid, content, options);
            }
            addToQueue({ jid, content, options });
            return null;
        };
        
        m.reply = (text) => queueOrSendMessage(m.from, { text }, { quoted: m });
        
        m.send = (text) => queueOrSendMessage(m.from, { text });
        
        m.target = (jid, text) => queueOrSendMessage(jid, { text });
        
        m.sendMessage = (jid, content, options = {}) => queueOrSendMessage(jid, content, options);
        
        m.sticker = async (media) => {
            try {
                const buffer = await getBuffer(media);
                
                const sticker = new Sticker(buffer, {
                    pack: config.packName,
                    author: `${m.pushName} | ${config.botName}`,
                    type: StickerTypes.FULL,
                    quality: 50
                });
                
                const stickerBuffer = await sticker.toBuffer();
                return queueOrSendMessage(m.from, { sticker: stickerBuffer }, { quoted: m });
            } catch (error) {
                console.error("Gagal membuat stiker:", error.message);
                const errorMessage = error.message.includes('ffmpeg') 
                    ? 'Gagal membuat stiker dari video. FFmpeg tidak terinstal di server.'
                    : 'Gagal membuat stiker. Terjadi kesalahan internal.';
                return queueOrSendMessage(m.from, { text: errorMessage }, { quoted: m });
            }
        };
        
        m.media = async (caption, media) => {
            let data, options = {};
            
            if (media === undefined) {
                media = caption;
                caption = '';
            }
            
            data = await getBuffer(media);
            const type = await fileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: 'bin' };
            
            if (/image/.test(type.mime)) {
                options = { image: data, caption: caption };
            } else if (/video/.test(type.mime)) {
                options = { video: data, caption: caption };
            } else if (/audio/.test(type.mime)) {
                options = { audio: data, mimetype: 'audio/mp4' };
            }
            
            return queueOrSendMessage(m.from, options, { quoted: m });
        };
    }
    
    return m;
};