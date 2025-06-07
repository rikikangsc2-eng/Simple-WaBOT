const { proto, getContentType } = require('@whiskeysockets/baileys');
const { getBuffer } = require('./functions');
const sharp = require('sharp');
const fileType = require('file-type');

exports.serialize = async (sock, m) => {
    if (!m) return m;

    let M = proto.WebMessageInfo;
    if (m.key) {
        m.id = m.key.id;
        m.isGroup = m.key.remoteJid.endsWith('@g.us');
        m.from = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.sender = m.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net' || sock.user.id) : (m.key.participant || m.key.remoteJid);
    }

    if (m.message) {
        m.type = getContentType(m.message);
        m.msg = (m.type === 'viewOnceMessage' ? m.message[m.type].message[getContentType(m.message[m.type].message)] : m.message[m.type]);

        m.body = m.message.conversation ||
            m.msg.text ||
            m.msg.caption ||
            (m.type === 'listResponseMessage' && m.msg.singleSelectReply.selectedRowId) ||
            (m.type === 'buttonsResponseMessage' && m.msg.selectedButtonId) ||
            (m.type === 'templateButtonReplyMessage' && m.msg.selectedId) ||
            '';

        m.reply = (text) => sock.sendMessage(m.from, { text }, { quoted: m });

        m.send = (text) => sock.sendMessage(m.from, { text });

        m.target = (jid, text) => sock.sendMessage(jid, { text });

        m.sendMessage = async (jid, content, options = {}) => sock.sendMessage(jid, content, options);

        m.sticker = async (media) => {
            const buffer = await getBuffer(media);
            const sticker = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFormat('webp')
                .toBuffer();
            return sock.sendMessage(m.from, { sticker }, { quoted: m });
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

            return sock.sendMessage(m.from, options, { quoted: m });
        };
    }

    return m;
};