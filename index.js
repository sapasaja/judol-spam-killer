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

