const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const payitem = require("./payitem");
const donationSystem = require("../utils/trakteer");

// ================== KONFIG ==================
const CHANNEL_ID = "1471552407438757949";
const TOKEN_DB = path.join(__dirname, "../database/tokens.json");
const PRODUCT_DB = path.join(__dirname, "../database/products.json");

// ================== FLAGS SETUP ==================
const FLAGS_DIR = path.join(__dirname, "../flags");
if (!fs.existsSync(FLAGS_DIR)) {
  fs.mkdirSync(FLAGS_DIR, { recursive: true });
}
const FLAG_PATH = path.join(FLAGS_DIR, `mainshop_${CHANNEL_ID}.flag`);

// ================== SAFE JSON ==================
function safeReadJSON(filePath, defaultData) {
  try {
    if (!fs.existsSync(filePath)) {
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

// ================== TOKEN SYSTEM ==================
function generateToken() {
  const numbers = "0123456789";
  let result = "TRX-";

  for (let i = 0; i < 6; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return result;
}

function loadTokens() {
  return safeReadJSON(TOKEN_DB, {});
}

function saveTokens(data) {
  safeWriteJSON(TOKEN_DB, data);
}

// ================== PRODUCT SYSTEM ==================
function loadProducts() {
  return safeReadJSON(PRODUCT_DB, []);
}

function generateProductList() {
  const products = loadProducts();
  if (products.length === 0) {
    return "Belum ada produk tersedia.\n";
  }

  let text = "";

  for (const p of products) {

    text +=
      `📦[\`\`id:${p.id}\`\`]\n` +
      `- Pemilik Toko : ${p.ownerName}\n` +
      `- Nama Product : ${p.nama}\n` +
      `- Jumlah Product : ${p.jumlah ?? "-"}\n` +
      `- Status : ${p.status}\n` +
      `- Harga : ${Number(p.harga || 0).toLocaleString("id-ID")} 🪙\n`;

    if (p.link && p.link.startsWith("http")) {
      text += `[Klik di sini untuk melihat gambar/Etalase](${p.link})\n`;
    }

    text += `\n`;
  }

  return text;
}



// ================== UPDATE SHOP EMBED ==================
async function updateShopEmbed(client) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return;

  const productsText = generateProductList();

  const embed = new EmbedBuilder()
  .setTitle("🛒 moonners Digital Store")
  .setColor("#573838")
  .setDescription(
    "Selamat datang di **moonners Digital Store**!\n\n" +
    "Nikmati layanan digital yang cepat, aman, dan terpercaya.\n" +
    "Solusi cerdas dengan proses otomatis"
  )
  .addFields({
    name: "📦 Daftar Produk",
    value:
      "==============================================\n" +
      productsText +
      "==============================================\n\n",
    inline: false
  })
  .addFields({
    name: "🔗 Informasi Penting",
    value:
      "- 📌 Cara Order : <#1472538294381318337>\n" +
      "- 🪙 Cara Isi Saldo : <#1472538264484188262>\n" +
      "- 📜 Terms of Service : <#1448273262688866304>\n" +
      "- 🛍️ catalog-product : <#1472642471921057832>\n" +
      "- 🪙 **Pembayaran Resmi: **" +
      "[Klik di sini untuk bayar](https://trakteer.id/modinner)",
    inline: false
  })
  .addFields({
    name: "",
    value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
    inline: false
  })
  .setFooter({
    text: "moonners Digital Store - Your Digital Service Solution"
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("beli_barang_button")
      .setLabel("Beli Barang")
      .setStyle(ButtonStyle.Success),
  
    new ButtonBuilder()
      .setCustomId("saldo_button")
      .setLabel("Saldo")
      .setStyle(ButtonStyle.Primary),
  
    new ButtonBuilder()
      .setCustomId("generate_token_button")
      .setLabel("Token")
      .setStyle(ButtonStyle.Secondary)
  );

  // ===== CEK FLAG =====
  if (fs.existsSync(FLAG_PATH)) {
    const messageId = fs.readFileSync(FLAG_PATH, "utf8");

    try {
      const oldMsg = await channel.messages.fetch(messageId);
      await oldMsg.edit({ embeds: [embed], components: [row] });
      return;
    } catch {
      fs.unlinkSync(FLAG_PATH);
    }
  }

  // ===== KIRIM BARU =====
  const msg = await channel.send({
    embeds: [embed],
    components: [row]
  });

  fs.writeFileSync(FLAG_PATH, msg.id);
}

// ================== EXPORT ==================
module.exports = {
  data: { name: "mainshop" },

  async sendInitialShopMessage(client) {
    await updateShopEmbed(client);
  },

  async handleInteraction(interaction, client) {

    // ================= BUTTON =================
    if (interaction.isButton()) {

      // ================= SALDO BUTTON =================
      if (interaction.customId === "saldo_button") {
    
        const userId = interaction.user.id;
    
        const userCoins = donationSystem.getCoins(userId) || 0;
        const totalDonate = donationSystem.getTotalDonate
          ? donationSystem.getTotalDonate(userId)
          : 0;
    
const saldoEmbed = new EmbedBuilder()
  .setTitle("Informasi Saldo")
  .setColor(0x00ff99)
  .addFields(
    {
      name: "Total Coins",
      value: `${userCoins} Coins`,
      inline: true
    },
    {
      name: "Total Donate",
      value: `Rp ${Number(totalDonate).toLocaleString("id-ID")}`,
      inline: true
    }
  )
  .setFooter({
    text: `User: ${interaction.user.username}`
  })
  .setTimestamp();

await interaction.reply({
  embeds: [saldoEmbed],
  ephemeral: true
});
    
        return true;
      }
    
      // ================= TOKEN BUTTON =================
      if (interaction.customId === "generate_token_button") {
        const userId = interaction.user.id;
        const tokens = loadTokens();

        let existingToken = Object.keys(tokens).find(
          token => tokens[token] === userId
        );

        if (!existingToken) {
          existingToken = generateToken();
          tokens[existingToken] = userId;
          saveTokens(tokens);
        }

        await interaction.reply({
          content:
            `\`${existingToken}\`\n\n` +
            "Gunakan token ini saat donasi di Trakteer.\n",
          ephemeral: true
        });

        return true;
      }

      if (interaction.customId === "beli_barang_button") {
        const modal = new ModalBuilder()
          .setCustomId("submit_beli_barang")
          .setTitle("Form Pembelian");

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("id_product")
                .setLabel("ID Product")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("jumlah_product")
                .setLabel("Jumlah Product")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("nomor_user")
                .setLabel("Nomor (Jika tidak ada kosongin aja)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("alamat_user")
                .setLabel("Alamat Lengkap (Jika tidak ada kosongin aja)")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("note_user")
                .setLabel("Note (Jika tidak ada kosongin aja)")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
            )
          );

        await interaction.showModal(modal);
        return true;
      }
    }

    // ================= MODAL =================
    if (interaction.isModalSubmit()) {
      if (interaction.customId !== "submit_beli_barang") return false;

      await interaction.deferReply({ ephemeral: true });
      
      const idProduct = interaction.fields
  .getTextInputValue("id_product")
  .trim()
  .toUpperCase();

      const jumlahProduct = Number(interaction.fields.getTextInputValue("jumlah_product"));
      const nomor = interaction.fields.getTextInputValue("nomor_user") || "-";
      const alamat = interaction.fields.getTextInputValue("alamat_user") || "-";
      const note = interaction.fields.getTextInputValue("note_user") || "-";
      
      const success = await payitem.handlePurchase(
        interaction,
        idProduct,
        jumlahProduct,
        { alamat, nomor, note }
      );
      
      if (success) {
        await updateShopEmbed(client);
      }
      
      return true;
    }
    

    return false;
  }
};