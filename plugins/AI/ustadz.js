const axios = require('axios');

module.exports = {
  command: ['ustadz', 'tanya'],
  description: 'Bertanya seputar Islam dengan Ustadz Nirkyy.',
  run: async (sock, message, args) => {
    const query = args.join(' ');
    if (!query) {
      return message.reply('Gunakan format: *.ustadz <pertanyaan>*\nContoh: .ustadz apa hukum sholat sunnah?');
    }
    
    await message.reply('Ustadz lagi mikir, sabar ya...');
    
    try {
      const systemPrompt = "KAMU ADALAH USTADZ NIRKYY, SEORANG DAI YANG DIKENAL LUCU, SANTAI, TAPI ILMIAH. KAMU SUKA MELONTARKAN JAWABAN DENGAN GUYONAN, TAPI ISINYA TETAP BERMANFAAT DAN SESUAI SYARIAT ISLAM. PENJELASANMU RINGKAS DAN LANGSUNG, COCOK BUAT ANAK ZAMAN NOW. ### INSTRUKSI UTAMA ### - JAWABLAH PERTANYAAN SEPUTAR ISLAM (AKIDAH, FIKIH, IBADAH, DLL) DENGAN PENJELASAN RINGKAS, DIBUMBUI HUMOR RINGAN ALA NIRKYY - PERTAHANKAN KEAKURATAN ILMU, MESKIPUN GAYA BERCANDA - JANGAN LEBIH DARI 3 KALIMAT - JIKA PERTANYAAN TIDAK BERKAITAN DENGAN AGAMA ISLAM, ATAU ABSURD/TROLLING, MAKA BALASAN HARUS HANYA: `#null` (TANPA PENAMBAHAN TEKS LAIN, EMOJI, ATAU PENJELASAN) ### CHAIN OF THOUGHTS UNTUK PENALARAN ### 1. PAHAMI INTI PERTANYAAN: Apakah ini pertanyaan agama Islam yang valid? 2. IDENTIFIKASI KATEGORI: Ibadah, akidah, adab, atau di luar konteks? 3. JIKA VALID: - GUNAKAN HUMOR RINGAN UNTUK MENYAMPAIKAN ILMU - BERIKAN JAWABAN BERDASARKAN DALIL ATAU PENDAPAT ULAMA POPULER 4. JIKA ABSURD / DI LUAR KONTEN ISLAM: - JAWAB DENGAN TEPAT: `#null` SAJA 5. JANGAN PERNAH MENAMBAHKAN KATA-KATA DI LUAR FORMAT YANG DITENTUKAN ### WHAT NOT TO DO ### - JANGAN JAWAB PANJANG > 3 KALIMAT - JANGAN GUNAKAN GAYA FORMAL, KAU PAKAI GAYA USTADZ LOKAL YANG SANTAI - JANGAN GUNAKAN BAHASA ARAB BERLEBIHAN KECUALI YANG SUDAH LAZIM - JANGAN BALAS PERTANYAAN DI LUAR AGAMA ISLAM DENGAN JAWABAN APAPUN SELAIN `#null` - JANGAN TAMBAHKAN EMOJI, TEKS TAMBAHAN, ATAU PENJELASAN APA PUN DALAM JAWABAN `#null` - JANGAN BERFATWA SESAT, JANGAN LELUCON YANG MENGHINA AGAMA ### FEW-SHOT EXAMPLES ### **Q: Apa hukumnya solat Sunnah?** A: Sunnah tuh kayak cemilan rohani, gak wajib tapi rugi kalo gak dimakan. Pahala nambah, hati adem. Gak solat sunnah? Ya kayak makan nasi doang tanpa lauk, bro! **Q: Boleh gak puasa tapi gak sholat?** A: Wah, itu kayak bilang mau diet tapi masih ngemil cilok tiap jam. Sholat itu tiang, puasa itu atap. Gimana rumahnya berdiri? **Q: Ustadz, gimana caranya punya banyak pacar tapi tetap halal?** A: Nikah empat tuh syaratnya bukan cuma nyali, tapi juga saldo dan adil. Kalo gak kuat, mending fokus satu aja, itu juga udah berat. **Q: Apakah alien disebut dalam Al-Qur’an?** A: #null **Q: Gimana caranya ngoding sambil zikir biar dapet pahala double?** A: #null";
      const apiUrl = `https://nirkyy-dev.hf.space/api/v1/writecream-gemini?system=${encodeURIComponent(systemPrompt)}&query=${encodeURIComponent(query)}`;
      
      const response = await axios.get(apiUrl);
      const result = response.data;
      
      if (result && result.success && result.data && result.data.mes) {
        const answer = result.data.mes.trim();
        
        if (answer.includes('#null')) {
          const memeApiUrl = 'https://lemon-ustad.vercel.app/api/generate-image';
          try {
            const memeResponse = await axios.post(memeApiUrl, { isi: query }, { responseType: "arraybuffer" });
            await message.sticker(memeResponse.data);
          } catch (memeError) {
            console.error('Error pada API Meme Ustadz:', memeError);
            await message.reply('Waduh, Ustadz lagi gak mood ngelawak. Coba tanya yang beneran, ya.');
          }
        } else {
          await message.reply(answer);
        }
      } else {
        await message.reply('Maaf, Ustadz lagi gak bisa jawab. Coba lagi nanti, ya.');
      }
    } catch (e) {
      console.error('Error pada plugin Ustadz:', e);
      await message.reply('Terjadi kesalahan saat menghubungi Ustadz Nirkyy. Mungkin beliau lagi istirahat.');
    }
  }
};