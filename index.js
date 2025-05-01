require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');



console.log(`
    ███████╗██████╗  █████╗ ███╗   ███╗██╗  ██╗██╗██╗     ██╗     ███████╗██████╗ 
    ██╔════╝██╔══██╗██╔══██╗████╗ ████║██║ ██╔╝██║██║     ██║     ██╔════╝██╔══██╗
    ███████╗██████╔╝███████║██╔████╔██║█████╔╝ ██║██║     ██║     █████╗  ██████╔╝
    ╚════██║██╔═══╝ ██╔══██║██║╚██╔╝██║██╔═██╗ ██║██║     ██║     ██╔══╝  ██╔══██╗
    ███████║██║     ██║  ██║██║ ╚═╝ ██║██║  ██╗██║███████╗███████╗███████╗██║  ██║
    ╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
    ----------------------------app-by-onnoyukihiro--------------------------------
    `);

// Setup readline untuk minta input ID YouTube
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fungsi untuk meminta input dari pengguna
async function getVideoIds() {
  return new Promise((resolve) => {
    rl.question("ID YouTube kamu mana ? tulis disini 👉 : ", (input) => {
      const videoIds = input.split(',').map(id => id.trim()); // Pisahkan ID berdasarkan koma, hapus spasi
      rl.close(); // Tutup interface readline
      resolve(videoIds);
    });
  });
}

// Fungsi utama buat cek dan hapus spam
async function checkAndDeleteSpam(VIDEO_IDS) {
  try {
    const auth = await authorize();

    for (const videoId of VIDEO_IDS) {
      console.log(`\n📹 Proses video ID: ${videoId} jam ${new Date().toISOString()}`);
      let hasSpam = true;

      // Terus cek sampai nggak ada spam
      while (hasSpam) {
        hasSpam = false; // Reset flag

        // Cek live chat (kalau video lagi live streaming)
        const liveChatId = await getLiveChatId(auth, videoId);
        if (liveChatId) {
          console.log(`Live chat ID: ${liveChatId}`);
          const spamMessages = await fetchLiveChatMessages(auth, liveChatId);

          if (spamMessages.length > 0) {
            console.log(`🚫 Ada ${spamMessages.length} pesan spam di live chat...`);
            await deleteLiveChatMessages(auth, spamMessages);
            console.log('✅ Pesan live chat spam berhasil dihapus.');
            hasSpam = true; // Spam ditemukan, lanjutkan loop
          } else {
            console.log('✅ Nggak ada spam di live chat.');
          }
        } else {
          console.log(`⚠️ Video ID ${videoId} bukan live stream atau live chat nggak aktif.`);
        }

        // Cek komentar biasa
        const spamComments = await fetchComments(auth, videoId);

        if (spamComments.length > 0) {
          console.log(`🚫 Ada ${spamComments.length} komentar spam...`);
          await deleteComments(auth, spamComments);
          console.log('✅ Komentar spam berhasil dihapus.');
          hasSpam = true; // Spam ditemukan, lanjutkan loop
        } else {
          console.log('✅ Nggak ada komentar spam.');
        }

        // Delay sebelum cek lagi untuk hindarin rate limit API
        if (hasSpam) {
          console.log(`Nunggu ${LOOP_DELAY_MS}ms sebelum cek lagi...`);
          await delay(LOOP_DELAY_MS);
        }
      }

      console.log(`✅ Proses video ID: ${videoId} selesai. Nggak ada lagi spam.`);
    }
  } catch (error) {
    console.error('Error di checkAndDeleteSpam:', error.message);
  }
}

// Jalankan terus-menerus setiap 10 detik
async function startSpamChecker(VIDEO_IDS) {
  console.log('Spam checker lagi jalan. Cek spam setiap 10 detik.');
  while (true) {
    await checkAndDeleteSpam(VIDEO_IDS);
    console.log(`Nunggu ${CHECK_INTERVAL_MS}ms sebelum siklus berikutnya...`);
    await delay(CHECK_INTERVAL_MS);
  }
}

// Mulai aplikasi
async function startApp() {
  const VIDEO_IDS = await getVideoIds(); // Minta input video ID
  console.log(`Video ID yang dipilih: ${VIDEO_IDS.join(', ')}`);

  // Lanjutkan aplikasi dengan VIDEO_IDS yang baru
  await startSpamChecker(VIDEO_IDS);
}

// Mulai aplikasi
startApp();
