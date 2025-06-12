const db = require('../../lib/database');

const activeExplorations = new Map();

function formatCooldown(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes} menit ${seconds} detik`;
}

const stories = [{
    story: "Kamu menemukan sebuah peti tua di balik air terjun. Kelihatannya tidak terkunci. Ketik `.eksplor buka` untuk membukanya.",
    action: "buka",
    successChance: 0.6,
    success: {
        message: "Kamu membuka peti dan menemukan sekantong emas! Kamu mendapatkan {reward_amount} gram Emas.",
        reward: {
            type: 'item',
            name: 'emas',
            min: 2,
            max: 5
        }
    },
    failure: {
        message: "Sial! Peti itu ternyata jebakan. Sebuah panah melesat dan melukaimu. Kamu kehilangan Rp {penalty_amount} untuk berobat.",
        penalty: {
            type: 'balance',
            min: 500,
            max: 2000
        }
    }
}, {
    story: "Seorang pedagang misterius dengan jubah hitam menawarkan sebuah belati berkilau. Katanya, ini terbuat dari baja murni. Ketik `.eksplor beli` untuk membelinya seharga 10 Iron.",
    action: "beli",
    successChance: 0.5,
    success: {
        message: "Ternyata benar! Belati itu terasa kuat dan seimbang. Kamu mendapatkan 1 Baja.",
        reward: {
            type: 'item',
            name: 'baja',
            min: 1,
            max: 1
        },
        cost: {
            type: 'item',
            name: 'iron',
            amount: 10
        }
    },
    failure: {
        message: "Penipu! Setelah kamu berikan 10 Iron, pedagang itu kabur dan belatinya ternyata hanya besi tua berkarat.",
        penalty: {
            type: 'item',
            name: 'iron',
            amount: 10
        }
    }
}, {
    story: "Kamu melihat jejak kaki aneh menuju ke dalam hutan lebat. Sepertinya bukan jejak manusia atau hewan biasa. Ketik `.eksplor ikuti` untuk menyelidikinya.",
    action: "ikuti",
    successChance: 0.7,
    success: {
        message: "Jejak itu membawamu ke sarang monster yang ditinggalkan. Kamu menemukan beberapa bongkahan Iron mentah! Kamu mendapatkan {reward_amount} Iron.",
        reward: {
            type: 'item',
            name: 'iron',
            min: 10,
            max: 20
        }
    },
    failure: {
        message: "Kamu tersesat! Kamu berputar-putar di hutan dan kembali ke tempat semula dengan kelelahan.",
        penalty: null
    }
}, {
    story: "Di tengah padang rumput, ada sebuah pohon dengan buah berwarna keemasan. Terlihat sangat menggiurkan. Ketik `.eksplor panjat` untuk mengambilnya.",
    action: "panjat",
    successChance: 0.65,
    success: {
        message: "Kamu berhasil memanjat dan memetik buah emas. Rasanya manis dan menyegarkan! Kamu mendapat Rp {reward_amount}.",
        reward: {
            type: 'balance',
            min: 3000,
            max: 7000
        }
    },
    failure: {
        message: "Apes! Dahan yang kamu pijak patah dan kamu terjatuh. Kakimu terkilir dan harus membayar Rp {penalty_amount} untuk pijat.",
        penalty: {
            type: 'balance',
            min: 1000,
            max: 3000
        }
    }
}, {
    story: "Kamu menemukan mulut gua yang gelap dan lembab. Terdengar suara tetesan air dari dalam. Ketik `.eksplor masuk` untuk menjelajahinya.",
    action: "masuk",
    successChance: 0.55,
    success: {
        message: "Dengan hati-hati, kamu masuk dan menemukan dinding gua yang dipenuhi Batubara berkualitas tinggi! Kamu mendapatkan {reward_amount} Bara.",
        reward: {
            type: 'item',
            name: 'bara',
            min: 15,
            max: 25
        }
    },
    failure: {
        message: "Begitu masuk, segerombolan kelelawar terbang keluar dan menyerangmu! Kamu lari terbirit-birit dan menjatuhkan Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 800,
            max: 2500
        }
    }
}, {
    story: "Sebuah surat dalam botol terdampar di tepi pantai. Kertasnya terlihat tua dan rapuh. Ketik `.eksplor baca` untuk melihat isinya.",
    action: "baca",
    successChance: 0.4,
    success: {
        message: "Isinya adalah peta harta karun! Kamu mengikuti peta dan menemukan lokasi X. Kamu menggali dan mendapat Rp {reward_amount}!",
        reward: {
            type: 'balance',
            min: 10000,
            max: 25000
        }
    },
    failure: {
        message: "Surat itu berisi kutukan kuno! Tiba-tiba angin kencang datang dan menerbangkan sebagian uangmu. Kamu kehilangan Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 2000,
            max: 5000
        }
    }
}, {
    story: "Sebuah patung kuno berdiri di tengah reruntuhan. Matanya seolah-olah mengawasimu. Ketik `.eksplor sentuh` untuk menyentuh patung itu.",
    action: "sentuh",
    successChance: 0.5,
    success: {
        message: "Patung itu bersinar dan memberimu berkat! Kamu merasa lebih kuat dan beruntung. Kamu mendapatkan {reward_amount} gram Emas.",
        reward: {
            type: 'item',
            name: 'emas',
            min: 1,
            max: 3
        }
    },
    failure: {
        message: "Patung itu ternyata berhantu! Sosok arwah keluar dan membuatmu lari ketakutan, dompetmu terjatuh dan kehilangan Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 1500,
            max: 4000
        }
    }
}, {
    story: "Di puncak gunung, kamu melihat bunga langka yang kelopaknya berkilauan seperti pelangi. Ketik `.eksplor petik` untuk mengambilnya.",
    action: "petik",
    successChance: 0.7,
    success: {
        message: "Kamu berhasil memetik bunga itu dan menjualnya ke kolektor. Kamu mendapat bayaran Rp {reward_amount}!",
        reward: {
            type: 'balance',
            min: 5000,
            max: 10000
        }
    },
    failure: {
        message: "Awas! Bunga itu dilindungi oleh lebah raksasa. Kamu disengat dan harus membayar Rp {penalty_amount} untuk membeli obat.",
        penalty: {
            type: 'balance',
            min: 2000,
            max: 4000
        }
    }
}, {
    story: "Kamu menemukan seekor anak kucing yang terjebak di atas pohon tinggi. Ia mengeong ketakutan. Ketik `.eksplor tolong` untuk menolongnya.",
    action: "tolong",
    successChance: 0.8,
    success: {
        message: "Kamu berhasil menyelamatkan anak kucing itu. Pemiliknya, seorang nenek kaya, memberimu hadiah Rp {reward_amount} sebagai ucapan terima kasih.",
        reward: {
            type: 'balance',
            min: 2000,
            max: 5000
        }
    },
    failure: {
        message: "Saat mencoba menolong, kamu malah dicakar habis-habisan oleh kucing galak itu. Kamu harus membayar Rp {penalty_amount} untuk suntik tetanus.",
        penalty: {
            type: 'balance',
            min: 500,
            max: 1500
        }
    }
}, {
    story: "Sebuah pedang legendaris tertancap di sebuah batu besar, persis seperti di cerita dongeng. Ketik `.eksplor cabut` untuk mencoba menariknya.",
    action: "cabut",
    successChance: 0.05,
    success: {
        message: "LUAR BIASA! Kamu berhasil mencabut pedang itu dari batu! Kamu adalah sang terpilih! Kamu mendapatkan 1 Pedang Legendaris.",
        reward: {
            type: 'item',
            name: 'pedanglegendaris',
            min: 1,
            max: 1
        }
    },
    failure: {
        message: "Kamu mencoba sekuat tenaga, tapi pedang itu tidak bergeming sedikit pun. Kamu hanya berhasil membuat pinggangmu sakit.",
        penalty: null
    }
}, {
    story: "Kamu menemukan kolam dengan air jernih berwarna biru kehijauan. Terlihat sangat menyegarkan. Ketik `.eksplor minum` untuk meminum airnya.",
    action: "minum",
    successChance: 0.6,
    success: {
        message: "Airnya terasa ajaib! Semua rasa lelahmu hilang seketika. Cooldown eksplorasimu direset!",
        reward: {
            type: 'cooldown',
            name: 'eksplor'
        }
    },
    failure: {
        message: "Uh-oh, air itu ternyata belum dimasak. Kamu sakit perut seharian dan harus membeli obat seharga Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 700,
            max: 2000
        }
    }
}, {
    story: "Di padang gurun, kamu melihat tumpukan batu yang aneh. Sepertinya bukan formasi alami. Ketik `.eksplor bongkar` untuk memeriksanya.",
    action: "bongkar",
    successChance: 0.5,
    success: {
        message: "Di bawah tumpukan batu, kamu menemukan sebuah artefak kuno yang terbuat dari emas! Kamu mendapatkan {reward_amount} gram Emas.",
        reward: {
            type: 'item',
            name: 'emas',
            min: 3,
            max: 7
        }
    },
    failure: {
        message: "Saat membongkar batu, seekor kalajengking besar keluar dan menyengatmu! Kamu harus membayar mahal untuk penawarnya sebesar Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 3000,
            max: 6000
        }
    }
}, {
    story: "Kamu mendengar melodi yang sangat indah datang dari arah danau. Penasaran, kamu ingin mencarinya. Ketik `.eksplor cari` untuk mencari sumber suara.",
    action: "cari",
    successChance: 0.6,
    success: {
        message: "Kamu menemukan seorang peri air sedang memainkan harpa. Ia tersenyum dan memberimu hadiah Rp {reward_amount} karena telah menikmati musiknya.",
        reward: {
            type: 'balance',
            min: 4000,
            max: 8000
        }
    },
    failure: {
        message: "Ternyata itu adalah suara Siren yang memikat! Kamu terhipnotis dan tanpa sadar menyerahkan Rp {penalty_amount} dari dompetmu.",
        penalty: {
            type: 'balance',
            min: 2500,
            max: 5000
        }
    }
}, {
    story: "Di lepas pantai, kamu melihat bangkai kapal karam. Mungkin ada harta karun di dalamnya. Ketik `.eksplor selami` untuk memeriksanya.",
    action: "selami",
    successChance: 0.55,
    success: {
        message: "Kamu menyelam dan menemukan sebuah peti berisi koin-koin kuno! Kamu mendapatkan {reward_amount} gram Emas.",
        reward: {
            type: 'item',
            name: 'emas',
            min: 4,
            max: 8
        }
    },
    failure: {
        message: "Saat sedang mencari, seekor gurita raksasa muncul dan melilitmu! Kamu berhasil lolos, tapi kehilangan beberapa peralatan senilai Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 3000,
            max: 5500
        }
    }
}, {
    story: "Seekor burung elang mendarat di dekatmu, di kakinya terikat sebuah gulungan surat. Ketik `.eksplor ambil` untuk mengambil surat itu.",
    action: "ambil",
    successChance: 0.75,
    success: {
        message: "Surat itu dari seorang raja yang meminta bantuan. Sebagai imbalan di muka, ia memberimu Rp {reward_amount}!",
        reward: {
            type: 'balance',
            min: 5000,
            max: 12000
        }
    },
    failure: {
        message: "Elang itu tidak ramah! Ia mematuk tanganmu dengan keras saat kamu mencoba mengambil suratnya. Biaya berobatmu adalah Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 1000,
            max: 2500
        }
    }
}, {
    story: "Kamu menemukan sebuah buku bersampul kulit yang tebal di perpustakaan tua. Judulnya 'Cara Cepat Kaya'. Ketik `.eksplor pelajari` untuk membacanya.",
    action: "pelajari",
    successChance: 0.6,
    success: {
        message: "Buku itu memberimu ide brilian tentang investasi! Kamu berhasil melipatgandakan uangmu dan mendapat keuntungan Rp {reward_amount}.",
        reward: {
            type: 'balance',
            min: 8000,
            max: 20000
        }
    },
    failure: {
        message: "Isi buku itu ternyata omong kosong. Kamu malah menghabiskan uang untuk 'investasi bodong' dan rugi Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 4000,
            max: 10000
        }
    }
}, {
    story: "Sebuah portal sihir berputar-putar di hadapanmu, warnanya ungu dan hitam. Menjanjikan petualangan atau bahaya. Ketik `.eksplor lewati` untuk masuk ke dalamnya.",
    action: "lewati",
    successChance: 0.4,
    success: {
        message: "Portal itu membawamu ke sebuah dimensi penuh harta! Kamu berhasil mengambil beberapa bongkah Baja sebelum portal tertutup. Kamu mendapatkan {reward_amount} Baja.",
        reward: {
            type: 'item',
            name: 'baja',
            min: 1,
            max: 2
        }
    },
    failure: {
        message: "Portal itu ternyata menuju dimensi kosong. Kamu terlempar kembali dengan pusing dan kehilangan sebagian ingatan... dan Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 5000,
            max: 15000
        }
    }
}, {
    story: "Kamu melihat golem batu sedang tertidur di sebuah ladang. Di punggungnya ada sebuah kristal bara yang besar. Ketik `.eksplor curi` untuk mengambilnya.",
    action: "curi",
    successChance: 0.3,
    success: {
        message: "Dengan sangat hati-hati, kamu berhasil mengambil kristal itu tanpa membangunkannya! Kamu mendapatkan {reward_amount} Bara.",
        reward: {
            type: 'item',
            name: 'bara',
            min: 20,
            max: 40
        }
    },
    failure: {
        message: "Golem itu terbangun! Dia marah dan melemparkanmu jauh sekali. Kamu babak belur dan harus membayar Rp {penalty_amount} untuk penyembuhan.",
        penalty: {
            type: 'balance',
            min: 7000,
            max: 15000
        }
    }
}, {
    story: "Kamu ditawari sebuah tantangan oleh seorang kakek tua: tebak di tangan mana koinnya. Ketik `.eksplor kanan` atau `.eksplor kiri`.",
    action: "kanan",
    successChance: 0.5,
    success: {
        message: "Pilihanmu benar! Kakek itu memberimu koin keberuntungan senilai Rp {reward_amount}.",
        reward: {
            type: 'balance',
            min: 5000,
            max: 5001
        }
    },
    failure: {
        message: "Salah tebak! Kamu harus membayar taruhan sebesar Rp {penalty_amount} kepada kakek itu.",
        penalty: {
            type: 'balance',
            min: 2500,
            max: 2501
        }
    }
}, {
    story: "Kamu melihat jamur aneh yang menyala dalam gelap. Bisa jadi berharga, bisa jadi beracun. Ketik `.eksplor makan` untuk mencobanya.",
    action: "makan",
    successChance: 0.45,
    success: {
        message: "Jamur itu memberimu energi luar biasa! Kamu merasa sangat beruntung dan menemukan Rp {reward_amount} di jalan pulang.",
        reward: {
            type: 'balance',
            min: 6000,
            max: 12000
        }
    },
    failure: {
        message: "Jamur itu sangat beracun! Kamu mengalami halusinasi dan harus dirawat dengan biaya Rp {penalty_amount}.",
        penalty: {
            type: 'balance',
            min: 4000,
            max: 8000
        }
    }
}, ];


module.exports = {
    command: 'eksplor',
    description: 'Memulai sebuah petualangan eksplorasi dengan cerita dan pilihan unik.',
    category: 'RPG',
    run: async (sock, message, args) => {
        const senderJid = message.sender;
        const action = args[0]?.toLowerCase();
        let usersDb = db.get('users');
        let cooldowns = db.get('cooldowns');
        const user = usersDb[senderJid] || {
            balance: 0
        };
        const userCooldowns = cooldowns[senderJid] || {};

        if (action) {
            const exploration = activeExplorations.get(senderJid);
            if (!exploration) {
                return message.reply('Kamu sedang tidak dalam eksplorasi. Ketik `.eksplor` untuk memulai petualangan baru.');
            }

            const {
                story,
                timeout
            } = exploration;
            if (story.action !== action && `${story.action}_alt` !== action) {
                if (story.id === 19 && (action === 'kiri' || action === 'kanan')) {
                    story.action = action;
                } else {
                    return message.reply(`Pilihan tidak sesuai. Perintah yang tersedia adalah: \`${config.prefix}eksplor ${story.action}\``);
                }
            }

            clearTimeout(timeout);
            activeExplorations.delete(senderJid);

            if (story.cost) {
                if (!user[story.cost.type] || user[story.cost.type] < story.cost.amount) {
                    return message.reply(`Kamu tidak punya cukup ${story.cost.name} untuk melakukan ini. Kamu butuh ${story.cost.amount}.`);
                }
            }

            const isSuccess = Math.random() < story.successChance;
            const outcome = isSuccess ? story.success : story.failure;

            let replyMessage = outcome.message;

            if (isSuccess) {
                if (story.cost) {
                    user[story.cost.name] -= story.cost.amount;
                }
                const reward = outcome.reward;
                if (reward) {
                    let amount = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
                    if (reward.type === 'balance') {
                        user.balance += amount;
                        replyMessage = replyMessage.replace('{reward_amount}', amount.toLocaleString());
                    } else if (reward.type === 'item') {
                        user[reward.name] = (user[reward.name] || 0) + amount;
                        replyMessage = replyMessage.replace('{reward_amount}', amount);
                    } else if (reward.type === 'cooldown') {
                        if (userCooldowns[reward.name]) {
                            delete userCooldowns[reward.name];
                        }
                    }
                }
            } else {
                const penalty = outcome.penalty;
                if (penalty) {
                    if (penalty.type === 'balance') {
                        let amount = Math.floor(Math.random() * (penalty.max - penalty.min + 1)) + penalty.min;
                        const finalPenalty = Math.min(user.balance, amount);
                        user.balance -= finalPenalty;
                        replyMessage = replyMessage.replace('{penalty_amount}', finalPenalty.toLocaleString());
                    } else if (penalty.type === 'item') {
                        const finalPenalty = Math.min(user[penalty.name] || 0, penalty.amount);
                        user[penalty.name] -= finalPenalty;
                        replyMessage = replyMessage.replace('{penalty_amount}', finalPenalty);
                    }
                }
                if (story.cost && story.failure.message.includes(story.cost.name)) {
                    user[story.cost.name] -= story.cost.amount;
                }
            }

            usersDb[senderJid] = user;
            cooldowns[senderJid] = userCooldowns;
            db.save('users', usersDb);
            db.save('cooldowns', cooldowns);
            return message.reply(replyMessage);

        } else {
            const cooldownTime = 15 * 60 * 1000;
            const lastEksplor = userCooldowns.eksplor || 0;

            if (Date.now() - lastEksplor < cooldownTime) {
                const timeLeft = cooldownTime - (Date.now() - lastEksplor);
                return message.reply(`Kamu baru saja selesai bertualang. Istirahatlah sejenak. Tunggu *${formatCooldown(timeLeft)}* lagi.`);
            }
            if (activeExplorations.has(senderJid)) {
                return message.reply('Kamu masih memiliki eksplorasi yang belum selesai. Selesaikan dulu petualanganmu!');
            }

            const randomStory = stories[Math.floor(Math.random() * stories.length)];

            const explorationTimeout = setTimeout(() => {
                if (activeExplorations.has(senderJid)) {
                    activeExplorations.delete(senderJid);
                    message.reply('Kamu terlalu lama untuk membuat keputusan dan kesempatan itu hilang begitu saja.');
                }
            }, 5 * 60 * 1000);

            activeExplorations.set(senderJid, {
                story: { ...randomStory,
                    id: stories.indexOf(randomStory)
                },
                timeout: explorationTimeout
            });

            if (!cooldowns[senderJid]) cooldowns[senderJid] = {};
            cooldowns[senderJid].eksplor = Date.now();
            db.save('cooldowns', cooldowns);

            await message.reply(randomStory.story);
        }
    }
};