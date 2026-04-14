
// ================== IMPORT ==================
const {
  Client,
  GatewayIntentBits,
  Collection,
  InteractionType,
  REST,
  Routes
} = require("discord.js");

const {
  processMessageXP,
  getRewardRolesForLevel,
  buildLevelUpMessage,
  getLevelUpChannelId
} = require("./minigames/system/levelsystems");

const fs = require("fs");
const path = require("path");
const express = require("express");

const { token, clientId, guildId } = require("./config.json");
const { addDonation } = require("./utils/trakteer");
const { sendDepositLog } = require("./utils/sendlogging");
const { createLevelUpCard } = require("./minigames/levelupCard");
const invoice = require("./commands/invoice.js");
const youtubeLiveMonitor = require("./commands/livestatus.js");
const deleteChannel = require("./commands/deletechannel.js");
const ticket = require("./admin/ticket.js");
const ticketMirror = require("./admin/ticketMirror.js");
// ================== EXPRESS SERVER ==================
const app = express();
app.use(express.static("public"));
app.use(express.json());


app.use(express.urlencoded({ extended: true }));

// healthcheck root
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Trakteer kadang test pakai GET/HEAD
app.get("/trakteer-webhook", (req, res) => {
  res.status(200).send("OK - webhook endpoint alive (use POST)");
});

app.head("/trakteer-webhook", (req, res) => {
  res.sendStatus(200);
});


// ================== DISCORD CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
});

client.commands = new Collection();

// ================== LOAD COMMAND ==================

const folders = ["commands", "minigames", "admin"];

for (const folder of folders) {

  const folderPath = path.join(__dirname, folder);

  if (!fs.existsSync(folderPath)) continue;

  const files = fs
    .readdirSync(folderPath)
    .filter(file => file.endsWith(".js"));

  for (const file of files) {

    const command = require(`./${folder}/${file}`);

    if (!command.data || !command.data.name) continue;

    client.commands.set(command.data.name, command);

  }

}

// ================== TRAKTEER WEBHOOK ==================
app.post("/trakteer-webhook", async (req, res) => {
  try {
    const data = req.body && typeof req.body === "object" ? req.body : {};
    console.log("📩 Webhook masuk:", data);

    const donationId = data.transaction_id;
    const userToken = data.supporter_message?.trim().toUpperCase(); // token TRX-XXXXX
    const amount = Number(data.price ?? data.net_amount ?? 0);

    if (!donationId || !userToken || !Number.isFinite(amount) || amount <= 0) {
      console.log("Payload test / data tidak lengkap:", data);
      return res.status(200).send("OK (ignored)");
    }

    const result = addDonation(userToken, donationId, amount);

    if (!result.success) {
      return res.status(200).send(result.message);
    }

    await sendDepositLog(client, result.userId, result.coinsAdded, result.totalCoins);

    console.log(`✅ Donation sukses: ${userToken} +${result.coinsAdded} coins`);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    return res.status(500).send("Server error");
  }
});


// ================== READY ==================
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

// ===== YOUTUBE LIVE MONITOR =====
if (youtubeLiveMonitor?.startYouTubeLiveMonitor) {
  youtubeLiveMonitor.startYouTubeLiveMonitor(client);
}
    
  // ===== REVIEW CHANNEL =====
const review = client.commands.get("review");
if (review?.sendReviewMessage) {
  await review.sendReviewMessage(client);
}

  // ===== MAIN SHOP =====
  const mainShop = client.commands.get("mainshop");
  if (mainShop?.sendInitialShopMessage) {
    await mainShop.sendInitialShopMessage(client);
  }

// 🔄 AUTO REFRESH SHOP SETIAP 60 DETIK
if (!global.shopInterval) {
  global.shopInterval = setInterval(async () => {
    const mainShop = client.commands.get("mainshop");
    if (mainShop?.sendInitialShopMessage) {
      await mainShop.sendInitialShopMessage(client);
    }
  }, 60000);
} // ✅ TUTUP IF DI SINI
  // ===== SHOP PANEL =====
  const shopPanel = client.commands.get("shoppanel");
  if (shopPanel?.sendPanelMessage) {
    await shopPanel.sendPanelMessage(client);
  }

});

// ================== INTERACTION ==================
client.on("interactionCreate", async interaction => {
  try {

    // ===== SLASH COMMAND =====
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.execute) {
        await command.execute(interaction);
      }
      return;
    } 
      
    if (interaction.isButton()) {

      // ===== ORDER SELESAI =====
      if (await deleteChannel.handleInteraction(interaction)) {
        return;
      }

      if (interaction.customId === "order_invoice") {
        await invoice.handleInteraction(interaction);
        return;
      }

      const mainShop = client.commands.get("mainshop");
      if (mainShop?.handleInteraction) {
        await mainShop.handleInteraction(interaction, client);
      }
        
        const sendlogging = client.commands.get("sendlogging");
if (sendlogging?.handleInteraction) {
  const handled = await sendlogging.handleInteraction(interaction, client);
  if (handled) return;
}

      const shopPanel = client.commands.get("shoppanel");
      if (shopPanel?.handleInteraction) {
        await shopPanel.handleInteraction(interaction, client);
      }

      const review = client.commands.get("review");
      if (review?.handleInteraction) {
        await review.handleInteraction(interaction, client);
      }

      return;
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit()) {

      const mainShop = client.commands.get("mainshop");
      if (mainShop?.handleInteraction) {
        await mainShop.handleInteraction(interaction, client);
      }

      const shopPanel = client.commands.get("shoppanel");
      if (shopPanel?.handleInteraction) {
        await shopPanel.handleInteraction(interaction, client);
      }

      return;
    }

  } catch (err) {
    console.error("❌ Interaction Error:", err);

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "Terjadi kesalahan!",
          ephemeral: true
        });
      } catch {}
    }
  }
});

// ================== MESSAGE CREATE ==================
client.on("messageCreate", async (message) => {
  try {
    if (ticket?.handleMessage) {
      await ticket.handleMessage(message);
    }

    if (ticketMirror?.handleMessage) {
      await ticketMirror.handleMessage(client, message);
    }

    // abaikan bot / DM
    if (message.author.bot || !message.guild) return;

    // ambil role member untuk booster XP
    const memberRoles = message.member?.roles?.cache?.map(role => role.id) || [];

    const result = processMessageXP(
      message.author.id,
      message.content,
      memberRoles
    );

    if (!result.success) return;

    if (result.leveledUp) {
      // role reward
      const rewardRoles = getRewardRolesForLevel(result.level);

      for (const roleId of rewardRoles) {
        const role = message.guild.roles.cache.get(roleId);
        if (!role) continue;

        try {
          if (!message.member.roles.cache.has(roleId)) {
            await message.member.roles.add(roleId);
          }
        } catch (err) {
          console.error(`Gagal menambahkan role ${roleId}:`, err);
        }
      }

      // kirim notif level up
      const channelId = getLevelUpChannelId();
      const levelUpText = buildLevelUpMessage(
        `<@${message.author.id}>`,
        result.oldLevel,
        result.level
      );

      const targetChannel = channelId
        ? message.guild.channels.cache.get(channelId)
        : message.channel;

      if (targetChannel?.isTextBased()) {
        try {
          const levelUpImage = await createLevelUpCard(
            message.author,
            result.oldLevel,
            result.level
          );

          await targetChannel.send({
            content: levelUpText,
            files: [levelUpImage]
          });
        } catch (err) {
          console.error("Gagal membuat/kirim gambar level up:", err);

          await targetChannel.send({
            content: levelUpText
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("Message handler error:", err);
  }
});
// ================== START SERVER ==================
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Webhook server jalan di port ${PORT}`);
});

// ================== REGISTER SLASH COMMAND ==================
const commands = [];

for (const command of client.commands.values()) {
  if (command.data?.toJSON) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("🔄 Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log("✅ Slash commands registered.");
  } catch (error) {
    console.error(error);
  }
})();

// ================== LOGIN ==================
client.login(token);