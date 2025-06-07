# Setting di Koyeb
- Setting Ke Dockerfile
- Gunakan port 3000
- Deploy Dan jangan lupa uptime di uptimerobot 

# 🛠️ Dokumentasi Fungsi Helper (`message`)

Objek `message` (atau `m`) yang diterima oleh setiap plugin sudah dilengkapi dengan fungsi-fungsi praktis:

-   `message.reply(text)`: Membalas pesan saat ini.
-   `message.send(text)`: Mengirim pesan di chat yang sama (tanpa reply).
-   `message.target(jid, text)`: Mengirim pesan ke JID (nomor) target.
-   `message.sticker(buffer_or_link)`: Membuat dan mengirim stiker dari buffer media atau URL.
-   `message.media(caption, buffer_or_link)`: Mengirim media (gambar/video/audio) dengan caption.
-   `message.sendMessage(jid, content, options)`: Akses langsung ke fungsi Baileys asli untuk kustomisasi penuh.
