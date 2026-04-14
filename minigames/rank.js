const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

const CONFIG_DIR = "/home/container/minigames/config";
const PLAYER_PATH = path.join(CONFIG_DIR, "player.json");
const LEVEL_PATH = path.join(CONFIG_DIR, "level.json");

const ALLOWED_CHANNEL_IDS = [
  "1485965632573800568",
  "1483366304256884778"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Lihat level dan progres XP milikmu atau member lain.")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member yang ingin Anda lihat informasinya.")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
if (!ALLOWED_CHANNEL_IDS.includes(interaction.channelId)) {
  return await interaction.reply({
    content: `Command ini hanya bisa digunakan di <#${ALLOWED_CHANNEL_IDS[0]}>`,
    flags: MessageFlags.Ephemeral
  });
}

      const targetUser = interaction.options.getUser("user") || interaction.user;

const players = loadJSON(PLAYER_PATH, {});
const levelConfig = loadJSON(LEVEL_PATH, {
  formula: {
    multiplier: 1.5,
    maxLevel: 100
  }
});

const userData = players[targetUser.id] || {
  profile: {
    coins: 15000,
    level: 1,
    xp: 0,
    lastMessageAt: 0
  },
  inventory: {
    materials: {},
    tools: {},
    raw: {},
    fish: []
  }
};

      const level = Number(userData.profile?.level || 1);
      const currentXp = Number(userData.profile?.xp || 0);
      const neededXp = getXpForLevel(level, levelConfig);
      const progress = neededXp > 0
        ? Math.max(0, Math.min(1, currentXp / neededXp))
        : 0;

      const rank = getUserRank(players, targetUser.id, levelConfig);

      const canvas = createCanvas(820, 220);
      const ctx = canvas.getContext("2d");

      // Background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#0a0a0a");
      gradient.addColorStop(0.5, "#1a0f14");
      gradient.addColorStop(1, "#ff4fa3");

      ctx.globalAlpha = 0.9;
      ctx.fillStyle = gradient;
      roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 24);
      ctx.fill();
      ctx.globalAlpha = 1;

      // overlay pink tipis
      ctx.fillStyle = "rgba(255, 192, 203, 0.12)";
      roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 24);
      ctx.fill();

      // Avatar
      const avatarURL = targetUser.displayAvatarURL({
        extension: "png",
        size: 256
      });
      const avatar = await loadImage(avatarURL);

      const avatarX = 26;
      const avatarY = 35;
      const avatarSize = 95;
      const avatarRadius = avatarSize / 2;

      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius + 4, 0, Math.PI * 2);
      ctx.fillStyle = "#0b0d10";
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Status bulat kecil
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize - 2, avatarY + avatarSize - 2, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4fa3";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#14171c";
      ctx.stroke();

      // Username + tag kecil
      const usernameX = 145;
      const usernameY = 88;

      const username = trimText(ctx, targetUser.username, 230);

      let smallTag = "";
      if ("discriminator" in targetUser && targetUser.discriminator && targetUser.discriminator !== "0") {
        smallTag = `#${targetUser.discriminator}`;
      } else {
        smallTag = `#${String(targetUser.id).slice(-4)}`;
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Sans";
      ctx.fillText(username, usernameX, usernameY);

      const usernameWidth = ctx.measureText(username).width;

      ctx.fillStyle = "#ffd1e6";
      ctx.font = "16px Sans";
      ctx.fillText(smallTag, usernameX + usernameWidth + 8, usernameY);

      // Rank + Level kanan atas
      ctx.textAlign = "right";

      ctx.fillStyle = "#ffd1e6";
      ctx.font = "12px Sans";
      ctx.fillText("RANK", 610, 34);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Sans";
      ctx.fillText(`#${rank}`, 690, 38);

      ctx.fillStyle = "#ffd1e6";
      ctx.font = "12px Sans";
      ctx.fillText("LEVEL", 760, 34);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Sans";
      ctx.fillText(`${level}`, 795, 38);

      ctx.textAlign = "left";

      // XP text
      const xpText = `${currentXp} / ${neededXp} XP`;
      ctx.fillStyle = "#ffd1e6";
      ctx.font = "16px Sans";
      const xpWidth = ctx.measureText(xpText).width;
      ctx.fillText(xpText, 790 - xpWidth, 98);

      // Progress bar bg
      const barX = 145;
      const barY = 118;
      const barWidth = 645;
      const barHeight = 22;

      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      roundRect(ctx, barX, barY, barWidth, barHeight, 11);
      ctx.fill();

      // Progress bar fill
      const fillWidth = Math.floor(barWidth * progress);
      if (fillWidth > 0) {
        const barGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        barGradient.addColorStop(0, "#ff7ab8");
        barGradient.addColorStop(0.5, "#ff4fa3");
        barGradient.addColorStop(1, "#ffd1e6");

        ctx.fillStyle = barGradient;
        roundRect(ctx, barX, barY, fillWidth, barHeight, 11);
        ctx.fill();
      }

      const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
        name: "rank.png"
      });

      await interaction.reply({
        files: [attachment]
      });
    } catch (error) {
      console.error("Rank command error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Gagal membuat gambar rank.",
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};

function loadJSON(filePath, defaultData = {}) {
  try {
    if (!fs.existsSync(filePath)) return defaultData;
    const raw = fs.readFileSync(filePath, "utf8");
    return raw.trim() ? JSON.parse(raw) : defaultData;
  } catch (err) {
    console.error(`Gagal membaca ${filePath}:`, err);
    return defaultData;
  }
}

function getXpForLevel(level, config) {
  const baseXp = Number(config?.formula?.baseXp || 100);
  const multiplier = Number(config?.formula?.multiplier || 1.5);
  return Math.floor(baseXp * Math.pow(multiplier, level - 1));
}

function getTotalXp(profile, config) {
  const level = Number(profile?.level || 1);
  const xp = Number(profile?.xp || 0);

  let total = xp;
  for (let i = 1; i < level; i++) {
    total += getXpForLevel(i, config);
  }

  return total;
}

function getUserRank(players, userId, config) {
  const sorted = Object.entries(players)
    .map(([id, data]) => ({
      id,
      totalXp: getTotalXp(data.profile || {}, config)
    }))
    .sort((a, b) => b.totalXp - a.totalXp);

  const index = sorted.findIndex(user => user.id === userId);
  return index === -1 ? 1 : index + 1;
}

function roundRect(ctx, x, y, width, height, radius) {
  if (width <= 0 || height <= 0) return;

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function trimText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  while (text.length > 0 && ctx.measureText(text + "...").width > maxWidth) {
    text = text.slice(0, -1);
  }

  return text + "...";
}