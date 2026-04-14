const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");


const OUTPUT_FOLDER = "./moonners/invoices";
const TOKEN_DB = path.join(__dirname, "../database/tokens.json");
const ALLOWED_ROLE_ID = "1448271893785477303";


function loadTokens() {
  try {
    if (!fs.existsSync(TOKEN_DB)) return {};
    const data = fs.readFileSync(TOKEN_DB, "utf8");
    return JSON.parse(data || "{}");
  } catch {
    return {};
  }
}

if (!fs.existsSync(OUTPUT_FOLDER)) {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
}

module.exports = {
  data: { name: "invoice" },

  async handleInteraction(interaction) {

    if (!interaction.isButton()) return;
    if (interaction.customId !== "order_invoice") return;

    const pembuatInvoice = interaction.member.displayName;


    // ================== CEK ROLE ==================
    if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Kamu tidak punya izin untuk membuat invoice.",
        ephemeral: true
      });
    }
    

// ================== CEK SUDAH ADA INVOICE ==================
const messages = await interaction.channel.messages.fetch({ limit: 20 });

const sudahAdaInvoice = messages.some(msg =>
  msg.author.id === interaction.client.user.id &&
  msg.attachments.size > 0
);

if (sudahAdaInvoice) {
  return; // stop tanpa kirim pesan
}



    try {

      await interaction.deferReply({ ephemeral: false });

      // ================== LOAD BACKGROUND ==================
      const bgPath = path.join(__dirname, "../moonners/invoice_bg.png");
      const background = await loadImage(bgPath);

      const canvas = createCanvas(background.width, background.height);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

// ================== AMBIL PEMBELI DARI TOPIC CHANNEL ==================
let buyerId = null;

if (interaction.channel?.topic?.startsWith("buyer:")) {
  buyerId = interaction.channel.topic.split("buyer:")[1];
}

if (!buyerId) {
  return interaction.editReply({
    content: "❌ Data pembeli tidak ditemukan di channel ini."
  });
}

// Fetch user pembeli (BUKAN yang klik tombol)
let buyerUser;
try {
  buyerUser = await interaction.client.users.fetch(buyerId);
} catch (err) {
  return interaction.editReply({
    content: "❌ Gagal mengambil data pembeli."
  });
}

const username = buyerUser.username;

// ================== AMBIL DATA PRODUK DARI EMBED ORDER ==================
const messages = await interaction.channel.messages.fetch({ limit: 5 });
const botMessage = messages.find(m => m.embeds.length > 0);

if (!botMessage) {
  return interaction.editReply({
    content: "❌ Tidak menemukan embed order."
  });
}

const embed = botMessage.embeds[0];

// Ambil tanggal dari waktu pesan dibuat
const tanggalPembelian = botMessage.createdAt.toLocaleDateString("id-ID", {
  timeZone: "Asia/Jakarta"
});




// ================== AMBIL ALAMAT ==================
const infoField = embed.fields.find(f => 
  f.name.includes("Informasi Tambahan")
);

let alamatUser = "-";

if (infoField) {
  const match = infoField.value.match(/Alamat : (.*)/);
  if (match) {
    alamatUser = match[1];
  }
}


const detailField = embed.fields.find(f => f.name === "Detail Produk");

if (!detailField) {
  return interaction.editReply({
    content: "❌ Detail produk tidak ditemukan."
  });
}

// Ambil ID Product dari embed
const idMatch = detailField.value.match(/ID Product : \*\*(.*?)\*\*/);
const idProduct = idMatch ? idMatch[1] : null;

// Ambil Jumlah
const jumlahMatch = detailField.value.match(/Jumlah(?: Product)? : \*\*(\d+)\*\*/);
const jumlahBeli = jumlahMatch ? Number(jumlahMatch[1]) : 0;

// ================== AMBIL HARGA DARI DATABASE ==================
const PRODUCT_DB = path.join(__dirname, "../database/products.json");

const products = JSON.parse(fs.readFileSync(PRODUCT_DB));
const product = products.find(p => p.id === idProduct);

if (!product) {
  return interaction.editReply({
    content: "❌ Produk tidak ditemukan di database."
  });
}

const hargaCoin = Number(product.harga); // ini coin
const totalCoin = hargaCoin * jumlahBeli;

const totalHarga = totalCoin * 1000; // konversi ke rupiah



const tanggal = new Date().toLocaleDateString("id-ID");

const tokens = loadTokens();

let trxId = Object.keys(tokens).find(
  token => tokens[token] === buyerId
);

if (!trxId) {
  trxId = "TRX-UNKNOWN";
}


      // ================== STYLE UMUM ==================
      ctx.fillStyle = "#000000";

      // ================== JUDUL KANAN ATAS ==================
      ctx.textAlign = "right";
      ctx.font = "bold 15px Arial";
      ctx.fillText("moonners store", canvas.width - 360, 120);

      ctx.font = "9px Arial";
      ctx.fillText(`${trxId}`, canvas.width - 36, 120);

      // ================== DATA KIRI ==================
      ctx.textAlign = "left";

      // Username lebih besar
      ctx.font = "16px Arial";
      ctx.fillText(`${username}`, 188, 206);
      
      // Nama toko lebih kecil
      ctx.font = "13px Arial";
      ctx.fillText(pembuatInvoice, 188, 221);      

      ctx.font = "10px Arial";
      ctx.fillText(alamatUser, 188, 236);
      

      // ================== TOTAL ==================

      ctx.font = "15px Arial";

      // Nomor
      ctx.fillText("1.", 55, 336);
      
      // Nama produk
      ctx.fillText(idProduct, 80, 336);
      
      // Harga total (karena beli 3)
      ctx.fillText(
        "Rp " + totalHarga.toLocaleString("id-ID"),
        225,
        336
      );
      
      // Jumlah
      ctx.fillText(jumlahBeli.toString(), 400, 336);
      


      // ================== TOTAL ==================
      ctx.font = "bold 24px Arial";
      ctx.fillText("TOTAL", 55, 510);

      ctx.font = "24px Arial";
      ctx.fillText(
        "Rp " + totalHarga.toLocaleString("id-ID"),
        360,
        510
      );
      


      // ================== FOOTER ==================
      ctx.textAlign = "left";
      ctx.font = "20px Arial";
      ctx.fillText(tanggalPembelian, 370, canvas.height - 50);      


      // ================== SAVE FILE ==================
      const filePath = path.join(
        OUTPUT_FOLDER,
        `invoice_${interaction.channel.id}.png`
      );

      // ================== GAMBAR TANDA TANGAN ==================
const signatureUrl = "https://i.ibb.co.com/ymc9R2qt/Screenshot-2026-02-13-171756-removebg-preview.png";

const signature = await loadImage(signatureUrl);

// Atur ukuran gambar (bisa kamu sesuaikan)
const sigWidth = 120;
const sigHeight = 60;

// Gambar ke canvas
ctx.drawImage(
  signature,
  370,                    // posisi X
  canvas.height - 120,    // posisi Y (atur kalau kurang pas)
  sigWidth,
  sigHeight
);

      fs.writeFileSync(filePath, canvas.toBuffer("image/png"));

      await interaction.editReply({
        files: [new AttachmentBuilder(filePath)]
      });

      return true;

    } catch (err) {
      console.error("Error invoice:", err);
      return true;
    }
  }
};