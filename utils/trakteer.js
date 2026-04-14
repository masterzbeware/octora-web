const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../database/donations.json");
const TOKEN_DB_PATH = path.join(__dirname, "../database/tokens.json");


// ================= SAFE JSON =================
function safeReadJSON(filePath, defaultData) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }

    const data = fs.readFileSync(filePath, "utf8").trim();
    if (!data) return defaultData;

    return JSON.parse(data);
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

function safeWriteJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}


// ================= LOAD DB =================
function loadDB() {
  return safeReadJSON(DB_PATH, {});
}

function saveDB(data) {
  safeWriteJSON(DB_PATH, data);
}

function loadTokens() {
  return safeReadJSON(TOKEN_DB_PATH, {});
}


// ================= TAMBAH DONASI =================
/*
  token        = TRX-XXXXX dari trakteer
  donationId   = ID unik dari trakteer (anti double)
  amount       = jumlah rupiah
*/
function addDonation(token, donationId, amount) {
  const tokens = loadTokens();
  const db = loadDB();

  if (!token || !donationId || !amount) {
    return {
      success: false,
      message: "Invalid parameters"
    };
  }

  // 🔎 Cari Discord User ID dari token
  const cleanToken = token.trim().toUpperCase();
const userId = tokens[cleanToken];

  if (!userId) {
    return {
      success: false,
      message: "Token tidak ditemukan"
    };
  }

  // Buat user jika belum ada
  if (!db[userId]) {
    db[userId] = {
      coins: 0,
      totalDonate: 0,
      processedDonations: []
    };
  }

  // ✅ Anti double claim
  if (db[userId].processedDonations.includes(donationId)) {
    return {
      success: false,
      message: "Already processed"
    };
  }

  const coinsToAdd = Math.floor(Number(amount) / 1000);

  db[userId].coins += coinsToAdd;
  db[userId].totalDonate += Number(amount);
  db[userId].processedDonations.push(donationId);

  saveDB(db);

  console.log(`💰 ${userId} dapat ${coinsToAdd} coins`);

  return {
    success: true,
    userId,
    coinsAdded: coinsToAdd,
    totalCoins: db[userId].coins
  };
}


// ================= GET COINS =================
function getCoins(userId) {
  const db = loadDB();
  return db[userId]?.coins || 0;
}

// ================= GET TOTAL DONATE =================
function getTotalDonate(userId) {
  const db = loadDB();
  return db[userId]?.totalDonate || 0;
}


// ================= REMOVE COINS =================
function removeCoins(userId, amount) {
  const db = loadDB();

  if (!db[userId]) return 0;

  db[userId].coins -= Number(amount);
  if (db[userId].coins < 0) db[userId].coins = 0;

  saveDB(db);

  return db[userId].coins;
}


module.exports = {
  addDonation,
  getCoins,
  removeCoins,
  getTotalDonate
};