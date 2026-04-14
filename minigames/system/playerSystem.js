const fs = require("fs");
const path = require("path");

const CONFIG_DIR = "/home/container/minigames/config";
const PLAYER_PATH = path.join(CONFIG_DIR, "player.json");

function ensureFile(filePath, defaultData = {}) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
}

function loadJSON(filePath, defaultData = {}) {
  ensureFile(filePath, defaultData);

  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data.trim() ? JSON.parse(data) : defaultData;
  } catch (err) {
    console.error(`Gagal membaca JSON ${filePath}:`, err);
    return defaultData;
  }
}

function saveJSON(filePath, data) {
  ensureFile(filePath, {});
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function ensurePlayerSchema(player = {}) {
  return {
    profile: {
      coins: Math.max(0, Number(player.profile?.coins ?? 15000)),
      level: Math.max(1, Number(player.profile?.level ?? 1)),
      xp: Math.max(0, Number(player.profile?.xp ?? 0)),
      totalXp: Math.max(
        0,
        Number(player.profile?.totalXp ?? player.profile?.xp ?? 0)
      )
    },
    activity: {
      messages: Math.max(0, Number(player.activity?.messages ?? 0)),
      lastMessageAt: Number(
        player.activity?.lastMessageAt ??
        player.profile?.lastMessageAt ??
        0
      )
    },
    leveling: {
      xpBoost: Math.max(0, Number(player.leveling?.xpBoost ?? 1)),
      restricted: Boolean(player.leveling?.restricted ?? false)
    }
  };
}

function migrateDB(db) {
  let changed = false;
  const migrated = {};

  for (const userId of Object.keys(db)) {
    const oldPlayer = db[userId] || {};
    const newPlayer = ensurePlayerSchema(oldPlayer);

    migrated[userId] = newPlayer;

    if (JSON.stringify(oldPlayer) !== JSON.stringify(newPlayer)) {
      changed = true;
    }
  }

  return { db: migrated, changed };
}

function loadDB() {
  const parsed = loadJSON(PLAYER_PATH, {});
  const { db, changed } = migrateDB(parsed);

  if (changed) {
    saveDB(db);
  }

  return db;
}

function saveDB(data) {
  saveJSON(PLAYER_PATH, data);
}

function getPlayer(userId) {
  const db = loadDB();

  if (!db[userId]) {
    db[userId] = ensurePlayerSchema({});
    saveDB(db);
  }

  return {
    db,
    player: db[userId]
  };
}

function setLevel(userId, level) {
  const { db, player } = getPlayer(userId);

  player.profile.level = Math.max(1, Number(level) || 1);

  saveDB(db);
  return player.profile.level;
}

function setXp(userId, xp) {
  const { db, player } = getPlayer(userId);

  player.profile.xp = Math.max(0, Number(xp) || 0);

  saveDB(db);
  return player.profile.xp;
}

function setTotalXp(userId, totalXp) {
  const { db, player } = getPlayer(userId);

  player.profile.totalXp = Math.max(0, Number(totalXp) || 0);

  saveDB(db);
  return player.profile.totalXp;
}

function addCoins(userId, amount) {
  const { db, player } = getPlayer(userId);

  amount = Number(amount) || 0;
  player.profile.coins += amount;

  if (player.profile.coins < 0) {
    player.profile.coins = 0;
  }

  saveDB(db);
  return player.profile.coins;
}

function setCoins(userId, amount) {
  const { db, player } = getPlayer(userId);

  player.profile.coins = Math.max(0, Number(amount) || 0);

  saveDB(db);
  return player.profile.coins;
}

function addMessage(userId, amount = 1) {
  const { db, player } = getPlayer(userId);

  player.activity.messages += Number(amount) || 0;
  if (player.activity.messages < 0) {
    player.activity.messages = 0;
  }

  player.activity.lastMessageAt = Date.now();

  saveDB(db);
  return player.activity.messages;
}

function setLastMessageAt(userId, timestamp = Date.now()) {
  const { db, player } = getPlayer(userId);

  player.activity.lastMessageAt = Number(timestamp) || 0;

  saveDB(db);
  return player.activity.lastMessageAt;
}

function setXpBoost(userId, boost) {
  const { db, player } = getPlayer(userId);

  player.leveling.xpBoost = Math.max(0, Number(boost) || 1);

  saveDB(db);
  return player.leveling.xpBoost;
}

function setRestricted(userId, restricted) {
  const { db, player } = getPlayer(userId);

  player.leveling.restricted = Boolean(restricted);

  saveDB(db);
  return player.leveling.restricted;
}

module.exports = {
  getPlayer,
  loadDB,
  saveDB,
  setLevel,
  setXp,
  setTotalXp,
  addCoins,
  setCoins,
  addMessage,
  setLastMessageAt,
  setXpBoost,
  setRestricted
};