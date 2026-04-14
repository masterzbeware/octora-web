const { createCanvas, loadImage } = require("canvas");
const { AttachmentBuilder } = require("discord.js");

async function createLevelUpCard(user, oldLevel, newLevel) {
  const canvas = createCanvas(900, 300);
  const ctx = canvas.getContext("2d");

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0a0a0a");
  gradient.addColorStop(0.5, "#1a0f14");
  gradient.addColorStop(1, "#ff4fa3");

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = gradient;
  roundRect(ctx, 20, 20, 860, 260, 30);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Overlay
  ctx.fillStyle = "rgba(255, 192, 203, 0.12)";
  roundRect(ctx, 20, 20, 860, 260, 30);
  ctx.fill();

  // Avatar
  const avatarURL = user.displayAvatarURL({
    extension: "png",
    size: 256
  });

  const avatar = await loadImage(avatarURL);

  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 150, 75, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 75, 75, 150, 150);
  ctx.restore();

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Sans";
  ctx.fillText("LEVEL UP!", 270, 90);

  // Username
  ctx.fillStyle = "#ffd1e6";
  ctx.font = "bold 34px Sans";
  ctx.fillText(trimText(ctx, user.username, 500), 270, 145);

  // Level text
  ctx.fillStyle = "#ffffff";
  ctx.font = "28px Sans";
  ctx.fillText(`Level ${oldLevel} → ${newLevel}`, 270, 195);

  // Subtext
  ctx.fillStyle = "#ffd1e6";
  ctx.font = "22px Sans";
  ctx.fillText("GG, kamu berhasil naik level!", 270, 235);

  return new AttachmentBuilder(canvas.toBuffer("image/png"), {
    name: "levelup.png"
  });
}

function roundRect(ctx, x, y, width, height, radius) {
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

module.exports = { createLevelUpCard };