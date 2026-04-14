const fs = require("fs");
const path = require("path");
const playerSystem = require("../system/playerSystem");

const CONFIG_DIR = "/home/container/minigames/config";
const LEVEL_PATH = path.join(CONFIG_DIR, "level.json");

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

/* =========================
   DEFAULT CONFIG
========================= */
function getDefaultLevelConfig() {
  return {
    messageXP: {
      mode: "random",
      min: 15,
      max: 40,
      cooldown: 60
    },
    formula: {
      baseXp: 100,
      multiplier: 1,
      maxLevel: 50
    },
    levelupMessage: {
      channelId: "",
      message: "{user} Telah mencapai level {level}. GG!"
    },
    roleReward: {},
    roleBooster: {}
  };
}

/* =========================
   LOAD level.json
========================= */
function loadLevels() {
  const raw = loadJSON(LEVEL_PATH, getDefaultLevelConfig());
  const defaults = getDefaultLevelConfig();

  return {
    messageXP: {
      mode: String(raw.messageXP?.mode ?? defaults.messageXP.mode),
      min: Number(raw.messageXP?.min ?? defaults.messageXP.min),
      max: Number(raw.messageXP?.max ?? defaults.messageXP.max),
      cooldown: Number(raw.messageXP?.cooldown ?? defaults.messageXP.cooldown)
    },
    formula: {
      baseXp: Number(raw.formula?.baseXp ?? defaults.formula.baseXp),
      multiplier: Number(raw.formula?.multiplier ?? defaults.formula.multiplier),
      maxLevel: Number(raw.formula?.maxLevel ?? defaults.formula.maxLevel)
    },
    levelupMessage: {
      channelId: String(
        raw.levelupMessage?.channelId ?? defaults.levelupMessage.channelId
      ),
      message: String(
        raw.levelupMessage?.message ?? defaults.levelupMessage.message
      )
    },
    roleReward: raw.roleReward || {},
    roleBooster: raw.roleBooster || {}
  };
}

/* =========================
   XP FORMULA
========================= */
function getXpForLevel(level) {
  const config = loadLevels();
  const currentLevel = Math.max(1, Number(level) || 1);
  const baseXp = Math.max(1, Number(config.formula?.baseXp ?? 100));
  const multiplier = Math.max(1, Number(config.formula?.multiplier ?? 1));

  return Math.floor(baseXp * Math.pow(multiplier, currentLevel - 1));
}

/* =========================
   MESSAGE XP
========================= */
function calculateMessageXP(content, memberRoles = [], player = null) {
  const config = loadLevels();
  const messageXP = config.messageXP || {};
  const roleBooster = config.roleBooster || {};

  const mode = String(messageXP.mode || "random").toLowerCase();
  const min = Number(messageXP.min ?? 15);
  const max = Number(messageXP.max ?? 40);

  let xp = 0;

  if (mode === "perword") {
    const words = String(content || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    xp = words;

    if (!Number.isNaN(min)) xp = Math.max(xp, min);
    if (!Number.isNaN(max)) xp = Math.min(xp, max);
  } else {
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    xp = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  let totalBooster = 0;

  for (const roleId of memberRoles) {
    if (roleBooster[roleId] != null) {
      totalBooster += Number(roleBooster[roleId]) || 0;
    }
  }

  const personalBoost = Math.max(0, Number(player?.leveling?.xpBoost ?? 1));

  xp = Math.floor(xp + (xp * totalBooster));
  xp = Math.floor(xp * personalBoost);

  if (xp < 0 || Number.isNaN(xp)) xp = 0;

  return xp;
}

function canGainMessageXP(userId) {
  const { db, player } = playerSystem.getPlayer(userId);
  const config = loadLevels();
  const cooldown = Math.max(0, Number(config.messageXP?.cooldown ?? 60));

  if (player.leveling?.restricted) {
    return {
      canGain: false,
      reason: "restricted",
      remaining: 0
    };
  }

  const now = Date.now();
  const last = Number(player.activity?.lastMessageAt || 0);

  if (now - last < cooldown * 1000) {
    return {
      canGain: false,
      reason: "cooldown",
      remaining: Math.ceil((cooldown * 1000 - (now - last)) / 1000)
    };
  }

  player.activity.lastMessageAt = now;
  player.activity.messages += 1;
  playerSystem.saveDB(db);

  return {
    canGain: true,
    reason: null,
    remaining: 0
  };
}

/* =========================
   ADD XP
========================= */
function addXP(userId, amount) {
  const { db, player } = playerSystem.getPlayer(userId);
  const config = loadLevels();
  const maxLevel = Math.max(1, Number(config.formula?.maxLevel ?? 50));

  amount = Number(amount) || 0;
  if (amount < 0) amount = 0;

  const oldLevel = Math.max(1, Number(player.profile?.level || 1));

  player.profile.xp += amount;
  player.profile.totalXp += amount;

  let leveledUp = false;

  while (
    player.profile.level < maxLevel &&
    player.profile.xp >= getXpForLevel(player.profile.level)
  ) {
    player.profile.xp -= getXpForLevel(player.profile.level);
    player.profile.level += 1;
    leveledUp = true;
  }

  if (player.profile.level >= maxLevel) {
    player.profile.level = maxLevel;
    if (player.profile.xp < 0) {
      player.profile.xp = 0;
    }
  }

  playerSystem.saveDB(db);

  return {
    oldLevel,
    level: player.profile.level,
    xp: player.profile.xp,
    totalXp: player.profile.totalXp,
    leveledUp
  };
}

function processMessageXP(userId, content, memberRoles = []) {
  const cooldownCheck = canGainMessageXP(userId);

  if (!cooldownCheck.canGain) {
    return {
      success: false,
      reason: cooldownCheck.reason,
      remaining: cooldownCheck.remaining
    };
  }

  const { player } = playerSystem.getPlayer(userId);
  const gainedXp = calculateMessageXP(content, memberRoles, player);
  const result = addXP(userId, gainedXp);

  return {
    success: true,
    gainedXp,
    ...result
  };
}

/* =========================
   ROLE REWARD
========================= */
function getRewardRolesForLevel(level) {
  const config = loadLevels();
  const roleReward = config.roleReward || {};

  return Object.entries(roleReward)
    .filter(([_, requiredLevel]) => Number(requiredLevel) === Number(level))
    .map(([roleId]) => roleId);
}

/* =========================
   LEVEL UP MESSAGE
========================= */
function getLevelUpChannelId() {
  const config = loadLevels();
  return config.levelupMessage?.channelId || "";
}

function buildLevelUpMessage(userTag, oldLevel, newLevel) {
  const config = loadLevels();
  const template =
    config.levelupMessage?.message || "{user} naik ke level {level}!";

  return template
    .replace(/\{user\}/g, String(userTag))
    .replace(/\{oldLevel\}/g, String(oldLevel))
    .replace(/\{level\}/g, String(newLevel));
}

module.exports = {
  loadLevels,
  getXpForLevel,
  calculateMessageXP,
  canGainMessageXP,
  addXP,
  processMessageXP,
  getRewardRolesForLevel,
  buildLevelUpMessage,
  getLevelUpChannelId
};