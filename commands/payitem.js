const fs = require("fs");
const path = require("path");
const { 
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");


const PRODUCT_DB = path.join(__dirname, "../database/products.json");
const TOKEN_DB = path.join(__dirname, "../database/tokens.json");

const LOG_CHANNEL_ID = "1471556855640621106"; // 🔥 Channel log pembelian
const ORDER_CATEGORY_ID = "1471701657745096705";

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

// ================== LOAD PRODUCTS ==================
function loadProducts() {
  return safeReadJSON(PRODUCT_DB, []);
}

function saveProducts(data) {
  safeWriteJSON(PRODUCT_DB, data);
}

// ================== LOAD TOKENS ==================
function loadTokens() {
  return safeReadJSON(TOKEN_DB, {});
}

function saveTokens(data) {
  safeWriteJSON(TOKEN_DB, data);
}
// ================== EXPORT ==================
module.exports = {

  async handlePurchase(interaction, idProduct, jumlahBeli, extraData = {}) {

const products = loadProducts();

// rapihin input ID dari user
const wantedId = String(idProduct || "").trim().toUpperCase();

// cari produk berdasarkan ID (lebih aman)
const product = products.find(p =>
  String(p.id || "").trim().toUpperCase() === wantedId
);

if (!product) {
  return interaction.editReply({
    content: "❌ ID Product tidak ditemukan.",
    ephemeral: true
  });
}

  
    const stokSekarang = Number(product.jumlah || 0);
    const jumlah = Number(jumlahBeli);
    
    if (isNaN(jumlah) || jumlah <= 0) {
      await interaction.editReply({
        content: "❌ Jumlah tidak valid."
      });
      return false;
    }
    
    if (stokSekarang < jumlah) {
      await interaction.editReply({
        content: `❌ Stok tidak cukup.\nStok tersedia: ${stokSekarang}`
      });
      return false;
    }

    // ================== HITUNG & CEK COINS ==================
const totalHarga = Number(product.harga) * jumlah;
const coinCost = Number(product.harga) * jumlah;

const donationSystem = require("../utils/trakteer");
const userCoins = donationSystem.getCoins(interaction.user.id);

if (userCoins < coinCost) {
  return interaction.editReply({
    content: `❌ Coins kamu tidak cukup.`,
    ephemeral: true
  });
}

// Potong coins SETELAH semua valid
donationSystem.removeCoins(interaction.user.id, coinCost);
    
    // ================== KURANGI STOK ==================
    product.jumlah = stokSekarang - jumlah;
    saveProducts(products);
  
    // ================== AMBIL DATA TAMBAHAN ==================
    const alamat = extraData?.alamat?.trim() || "-";
    const nomor = extraData?.nomor?.trim() || "-";
    const note = extraData?.note?.trim() || "-";
  
    // ================== EMBED LOG ==================
    const tanggal = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "medium"
    });
    
    const logEmbed = new EmbedBuilder()
      .setColor("#2ecc71")
      .setAuthor({
        name: "Transaksi Berhasil",
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(
        `🛒 **Pembelian berhasil diproses**\n` +
        `Terima kasih telah berbelanja di **moonners Digital Store**`
      )
      .addFields(
        {
          name: "👤 Informasi Pembeli",
          value:
            `• User : <@${interaction.user.id}>\n` +
            `• ID : \`${interaction.user.id}\``,
          inline: false
        },
        {
          name: "📦 Detail Produk",
          value:
            `• Nama Produk : **${product.nama || idProduct}**\n` +
            `• ID Product : **${idProduct}**\n` +
            `• Jumlah Product : **${jumlah}**\n` +
            `• Sisa Stok : **${product.jumlah}**\n`,
          inline: false
        },        
        {
          name: "📝 Informasi Tambahan",
          value:
            `• Nomor : ${nomor}\n` +
            `• Alamat : ${alamat}\n` +
            `• Note : ${note}`,
          inline: false
        },
        {
          name: "📅 Tanggal Pembelian",
          value: tanggal,
          inline: false
        }
      )
      .setFooter({
        text: "moonners Digital Store • Transaction Log"
      })
      .setTimestamp();
  
    try {
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch (err) {
      console.error("Gagal kirim log pembelian:", err);
    }

    // ================== BUAT CHANNEL ORDER ==================
try {
  const guild = interaction.guild;
  const tokens = loadTokens();

  const userToken = Object.keys(tokens).find(
    token => tokens[token] === interaction.user.id
  );

  if (userToken) {

    const cleanUsername = interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const channelName = `order-${cleanUsername}-${userToken}`;

const newChannel = await guild.channels.create({
  name: channelName,
  type: 0,
  parent: ORDER_CATEGORY_ID,
  topic: `buyer:${interaction.user.id}`, // ✅ SIMPAN ID PEMBELI DI SINI
  permissionOverwrites: [
    {
      id: guild.roles.everyone.id,
      deny: ["ViewChannel"]
    },
    {
      id: interaction.user.id,
      allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"]
    }
  ]
});


    const orderEmbed = new EmbedBuilder()
    .setColor("#3498db")
    .setAuthor({
      name: "Order Dibuat",
      iconURL: interaction.user.displayAvatarURL()
    })
    .setDescription(
      `**Detail Pesanan**\n\n` +
      `Mohon tunggu admin memproses pesanan kamu.`
    )
    .addFields(
      {
        name: "Informasi Pembeli",
        value:
          `• User : <@${interaction.user.id}>\n` +
          `• ID : \`${interaction.user.id}\``,
        inline: false
      },
      {
        name: "Detail Produk",
        value:
          `• Nama Produk : **${product.nama || idProduct}**\n` +
          `• ID Product : **${idProduct}**\n` +
          `• Jumlah : **${jumlah}**\n`,
        inline: false
      },      
      {
        name: "Customer Token",
        value: `\`${userToken}\``,
        inline: false
      }
    )
    .setFooter({
      text: "moonners Digital Store • Order System"
    })
    .setTimestamp();
  
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("order_selesai")
      .setLabel("Selesai")
      .setStyle(ButtonStyle.Success), // Hijau
  
    new ButtonBuilder()
      .setCustomId("order_invoice")
      .setLabel("Invoice")
      .setStyle(ButtonStyle.Secondary) // Abu-abu
  );
  
  await newChannel.send({
    embeds: [orderEmbed],
    components: [row]
  });
  }

} catch (err) {
  console.error("Gagal membuat channel order:", err);
}
  
    // ================== REPLY KE USER ==================
    await interaction.editReply({
      content: `✅ Pembelian berhasil!\n\n`
    });
    
    return true;
    
      }
    };

