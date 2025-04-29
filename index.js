require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// Konfigurasi
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';
const BLOCKED_WORDS_PATH = 'blockedword.json';
const CHECK_INTERVAL_MS = 10 * 1000; // 10 detik
const LOOP_DELAY_MS = 1000; // jeda 1 detik antara iterasi loop

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

// Load OAuth 2.0 client
async function authorize() {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`File credentials nggak ada di ${CREDENTIALS_PATH}. Tambahin dong file-nya di root project.`);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    }

    return await getNewToken(oAuth2Client);
  } catch (error) {
    console.error('Error di authorize:', error.message);
    throw error;
  }
}

// Dapetin token OAuth baru (manual input kalau StackBlitz nggak bisa otomatis)
function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('Authorize aplikasi ini dengan buka URL ini:', authUrl);
    console.log('Catatan: StackBlitz mungkin nggak support readline input. Ambil token-nya secara manual dan simpen ke token.json.');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Masukin kode dari halaman itu di sini: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          console.error('Error ngambil access token:', err.message);
          reject(err);
          return;
        }
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
        console.log('Token berhasil disimpan di', TOKEN_PATH);
        resolve(oAuth2Client);
      });
    });
  });
}

// Dapetin liveChatId dari video (kalau lagi live streaming)
async function getLiveChatId(auth, videoId) {
  const youtube = google.youtube({ version: 'v3', auth });

  try {
    const response = await youtube.videos.list({
      part: 'liveStreamingDetails',
      id: videoId,
    });

    const video = response.data.items[0];
    if (!video?.liveStreamingDetails?.activeLiveChatId) {
      return null; // Bukan live stream atau live chat nggak aktif
    }

    return video.liveStreamingDetails.activeLiveChatId;
  } catch (error) {
    console.error(`Error ngambil liveChatId buat video ${videoId}:`, error.message);
    return null;
  }
}

// Ambil pesan-pesan live chat
async function fetchLiveChatMessages(auth, liveChatId) {
  const youtube = google.youtube({ version: 'v3', auth });
  const spamMessages = [];

  try {
    const response = await youtube.liveChatMessages.list({
      liveChatId: liveChatId,
      part: 'snippet',
      maxResults: 200,
    });

    response.data.items.forEach((item) => {
      const messageText = item.snippet.textMessageDetails?.messageText || '';
      const messageId = item.id;

      console.log(`Cek pesan live chat: "${messageText}"`);

      if (getJudolMessage(messageText)) {
        console.log(`🚨 Spam terdeteksi: "${messageText}"`);
        spamMessages.push({ id: messageId, text: messageText });
      }
    });

    return spamMessages;
  } catch (error) {
    console.error('Error ngambil pesan live chat:', error.message);
    return [];
  }
}

// Hapus pesan-pesan live chat
async function deleteLiveChatMessages(auth, messageIds) {
  const youtube = google.youtube({ version: 'v3', auth });

  for (const message of messageIds) {
    try {
      await youtube.liveChatMessages.delete({
        id: message.id,
      });
      console.log(`Pesan live chat ID: ${message.id} ("${message.text}") berhasil dihapus`);
    } catch (error) {
      console.error(`Gagal hapus pesan ID ${message.id}:`, error.message);
    }
  }
}

// Ambil komentar-komentar biasa
async function fetchComments(auth, videoId) {
  const youtube = google.youtube({ version: 'v3', auth });
  const spamComments = [];

  try {
    const response = await youtube.commentThreads.list({
      part: 'snippet',
      videoId: videoId,
      maxResults: 100,
    });

    response.data.items.forEach((item) => {
      const comment = item.snippet.topLevelComment.snippet;
      const commentText = comment.textDisplay;
      const commentId = item.id;

      console.log(`Cek komentar: "${commentText}"`);

      if (getJudolMessage(commentText)) {
        console.log(`🚨 Spam terdeteksi: "${commentText}"`);
        spamComments.push(commentId);
      }
    });

    return spamComments;
  } catch (error) {
    if (error.code === 403 && error.errors?.[0]?.reason === 'commentsDisabled') {
      console.log(`⚠️ Video ID ${videoId} komentar dinonaktifkan.`);
    } else {
      console.error(`Error ngambil komentar untuk video ${videoId}:`, error.message);
    }
    return [];
  }
}

// Hapus komentar-ken komentar
async function deleteComments(auth, commentIds) {
  const youtube = google.youtube({ version: 'v3', auth });

  const totalCommentsToBeDeleted = commentIds.length;
  let totalDeletedComments = 0;

  while (commentIds.length > 0) {
    const commentIdsChunk = commentIds.splice(0, 50);
    try {
      await youtube.comments.setModerationStatus({
        id: commentIdsChunk,
        moderationStatus: 'rejected',
      });
      totalDeletedComments += commentIdsChunk.length;
      console.log(
        `Progres: ${totalDeletedComments}/${totalCommentsToBeDeleted} (${commentIds.length} sisa)\nKomentar yang dihapus:` ,
        commentIdsChunk
      );
    } catch (error) {
      console.error(`Gagal hapus komentar ID ${commentIdsChunk}:`, error.message);
    }
  }
}

// Deteksi pesan spam (buat live chat dan komentar biasa)
function getJudolMessage(text) {
  try {
    if (!fs.existsSync(BLOCKED_WORDS_PATH)) {
      throw new Error(`File blocked words nggak ada di ${BLOCKED_WORDS_PATH}. Tambahin dong file-nya di root project.`);
    }

    const normalizedText = text.normalize('NFKD');
    if (text !== normalizedText) {
      return true;
    }

    const blockedWords = JSON.parse(fs.readFileSync(BLOCKED_WORDS_PATH));
    const lowerText = text.toLowerCase();
    return blockedWords.some((word) => lowerText.includes(word.toLowerCase()));
  } catch (error) {
    console.error('Error di getJudolMessage:', error.message);
    return false;
  }
}

// Fungsi delay supaya nggak overload API
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
