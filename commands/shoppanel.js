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

const mainshop = require("./mainshop");
const stockmanage = require("../utils/stockmanage"); // pastikan sudah ada di atas


// ================== KONFIG ==================
const PANEL_CHANNEL_ID = "1471703011259842803";
const PRODUCT_DB = path.join(__dirname, "../database/products.json");

// ================== FLAGS SETUP ==================
const FLAGS_DIR = path.join(__dirname, "../flags");
if (!fs.existsSync(FLAGS_DIR)) {
  fs.mkdirSync(FLAGS_DIR, { recursive: true });
}

const PANEL_FLAG_PATH = path.join(
  FLAGS_DIR,
  `shoppanel_${PANEL_CHANNEL_ID}.flag`
);

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

function loadProducts() {
  return safeReadJSON(PRODUCT_DB, []);
}

function saveProducts(data) {
  safeWriteJSON(PRODUCT_DB, data);
}

// ================== GENERATE ID PRODUCT ==================
function generateProductId(products) {
  const next = products.length + 1;
  return `PDR-${String(next).padStart(3, "0")}`;
}

function renumberProducts(products) {
  // urutin produk berdasarkan nomor ID lama
  products.sort((a, b) => {
    const na = parseInt(String(a.id || "").split("-")[1] || "0", 10);
    const nb = parseInt(String(b.id || "").split("-")[1] || "0", 10);
    return na - nb;
  });

  // buat mapping ID lama -> ID baru
  const mappings = products.map((p, i) => ({
    oldId: p.id,
    newId: `PDR-${String(i + 1).padStart(3, "0")}`
  }));

  // pindahin stok ke TEMP dulu supaya tidak ketimpa
  for (const m of mappings) {
    stockmanage.renameProductId(m.oldId, `TMP-${m.newId}`);
  }

  // finalize TEMP -> ID baru
  for (const m of mappings) {
    stockmanage.renameProductId(`TMP-${m.newId}`, m.newId);
  }

  // update ID di products terakhir
  for (let i = 0; i < products.length; i++) {
    products[i].id = `PDR-${String(i + 1).padStart(3, "0")}`;
  }
}





// ================== EXPORT ==================
module.exports = {
  data: { name: "shoppanel" },

  // ================== KIRIM PANEL ==================
async sendPanelMessage(client) {
  try {
    const channel = await client.channels.fetch(PANEL_CHANNEL_ID);
    if (!channel) return;

const embed = new EmbedBuilder()
  .setTitle("MODINNER STORE PANEL")
  .setDescription("Sesuaikan dan kelola toko Anda dengan menetapkan atau menghapus item ke kategori, serta mengedit toko Anda, termasuk Nama Produk, Jumlah Produk, Status Produk, dan Harga Produk.")
  .setColor("#93ce3b")
  .setThumbnail("https://i.ibb.co/tMZhsjFB/moonners.png") // <-- TAMBAH INI
  .setFooter({ text: "moonners Digital Store - Your Digital Service Solution" })
  .setAuthor({
    name: "modinner store",
    iconURL: "https://i.ibb.co/tMZhsjFB/moonners.png"
  });

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("add_product_panel")
    .setLabel("Tambah Product")
    .setStyle(ButtonStyle.Success),

  new ButtonBuilder()
    .setCustomId("edit_product_panel")
    .setLabel("Edit Product")
    .setStyle(ButtonStyle.Success),

  new ButtonBuilder()
    .setCustomId("database_panel")
    .setLabel("Database")
    .setStyle(ButtonStyle.Success),

  new ButtonBuilder()
    .setCustomId("remove_product_panel")
    .setLabel("Remove Product")
    .setStyle(ButtonStyle.Danger)
);


    // ===== CEK FLAG =====
    if (fs.existsSync(PANEL_FLAG_PATH)) {
      const messageId = fs.readFileSync(PANEL_FLAG_PATH, "utf8");

      try {
        const oldMsg = await channel.messages.fetch(messageId);
        await oldMsg.edit({ embeds: [embed], components: [row] });
        return;
      } catch {
        fs.unlinkSync(PANEL_FLAG_PATH);
      }
    }

    // ===== KIRIM BARU =====
    const msg = await channel.send({
      embeds: [embed],
      components: [row]
    });

    fs.writeFileSync(PANEL_FLAG_PATH, msg.id);

  } catch (err) {
    console.error("Gagal kirim panel:", err);
  }
},   // <-- cuma ini saja


  async handleInteraction(interaction, client) {



    // ================= BUTTON =================
    if (interaction.isButton()) {
        
        // ================= DATABASE =================
if (interaction.customId === "database_panel") {
  const modal = new ModalBuilder()
    .setCustomId("submit_database_panel")
    .setTitle("Database");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("db_id_product")
        .setLabel("ID Product")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("db_list_stock")
        .setLabel("List Stock")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
  return true;
}


// ================= EDIT PRODUCT =================
if (interaction.customId === "edit_product_panel") {

  const modal = new ModalBuilder()
    .setCustomId("submit_edit_product")
    .setTitle("Edit Product");

  modal.addComponents(

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("edit_id_product")
        .setLabel("ID Product")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("edit_nama_product")
        .setLabel("Nama Product")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("edit_jumlah_product")
        .setLabel("Jumlah Product (angka)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("edit_status_product")
        .setLabel("Status Product")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),

    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("edit_harga_product")
        .setLabel("Harga Product (angka)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )

  );
    

  await interaction.showModal(modal);
  return true;
}
        
        // ================= REMOVE PRODUCT =================
if (interaction.customId === "remove_product_panel") {

  const modal = new ModalBuilder()
    .setCustomId("submit_remove_product")
    .setTitle("Remove Product");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("remove_id_product")
        .setLabel("Masukkan ID Product (contoh: PDR-001)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
  return true;
}

      if (interaction.customId !== "add_product_panel") return false;

      const modal = new ModalBuilder()
        .setCustomId("submit_product_panel")
        .setTitle("Tambah Product");

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("nama_product")
            .setLabel("Nama Product")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("jumlah_product")
            .setLabel("Jumlah Product (angka)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("status_product")
            .setLabel("Status Product")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("harga_product")
            .setLabel("Harga Product (angka saja)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("link_product")
            .setLabel("Link Gambar / Etalase (Opsional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        )
        
      );

      await interaction.showModal(modal);
      return true;
    }

    // ================= MODAL =================
    if (interaction.isModalSubmit()) {
        
        // ===== DATABASE SUBMIT =====
if (interaction.customId === "submit_database_panel") {
  await interaction.deferReply({ ephemeral: true });

  const id = interaction.fields.getTextInputValue("db_id_product").trim().toUpperCase();
  const listStock = interaction.fields.getTextInputValue("db_list_stock").trim();

  // REPLACE: stok lama diganti total dengan yang baru kamu input
  const result = stockmanage.setStockList(id, listStock);

  await interaction.editReply({
    content: `✅ Stock berhasil disimpan!\nID Product: **${result.id}**\nTotal Stock: **${result.count}**`
  });

  return true;
}




 // ===== EDIT PRODUCT =====
if (interaction.customId === "submit_edit_product") {

  await interaction.deferReply({ ephemeral: true });

  const products = loadProducts();

  const id = interaction.fields.getTextInputValue("edit_id_product").trim().toUpperCase();
  const nama = interaction.fields.getTextInputValue("edit_nama_product");
  const jumlah = parseInt(
    interaction.fields.getTextInputValue("edit_jumlah_product").replace(/\D/g, "")
  );
  const status = interaction.fields.getTextInputValue("edit_status_product");
  const harga = parseInt(
    interaction.fields.getTextInputValue("edit_harga_product").replace(/\D/g, "")
  );

  const productIndex = products.findIndex(p => p.id === id);

  if (productIndex === -1) {
    return interaction.editReply({ content: "❌ ID Product tidak ditemukan!" });
  }

  // 🔒 CEK OWNER
  if (products[productIndex].ownerId !== interaction.user.id) {
    return interaction.editReply({
      content: "❌ Kamu bukan pemilik product ini!"
    });
  }

  if (isNaN(jumlah) || jumlah <= 0) {
    return interaction.editReply({ content: "❌ Jumlah harus angka dan lebih dari 0!" });
  }

  if (isNaN(harga) || harga <= 0) {
    return interaction.editReply({ content: "❌ Harga harus angka dan lebih dari 0!" });
  }

  products[productIndex].nama = nama;
  products[productIndex].jumlah = jumlah;
  products[productIndex].status = status;
  products[productIndex].harga = harga;

  saveProducts(products);
  await mainshop.sendInitialShopMessage(client);

  await interaction.editReply({
    content: `✅ Product ${id} berhasil diupdate!`
  });

  return true;
}
      // ===== REMOVE PRODUCT =====
      if (interaction.customId === "submit_remove_product") {

        await interaction.deferReply({ ephemeral: true });

        const products = loadProducts();
const id = interaction.fields
  .getTextInputValue("remove_id_product")
  .trim()
  .toUpperCase();


        const productIndex = products.findIndex(p => p.id === id);

        if (productIndex === -1) {
          return interaction.editReply({
            content: "❌ ID Product tidak ditemukan!"
          });
        }
          
          // 🔒 CEK OWNER
if (products[productIndex].ownerId !== interaction.user.id) {
  return interaction.editReply({
    content: "❌ Kamu bukan pemilik product ini!"
  });
}

const removedProduct = products[productIndex];

products.splice(productIndex, 1);

// hapus stok milik produk yang dihapus
stockmanage.deleteProductStocks(removedProduct.id);

// rapihin ulang ID + pindahin stok
renumberProducts(products);

saveProducts(products);



        await mainshop.sendInitialShopMessage(client);

        await interaction.editReply({
          content: `✅ Product ${removedProduct.id} berhasil dihapus!`
        });

        return true;
      }

      // ===== TAMBAH PRODUCT =====
      if (interaction.customId === "submit_product_panel") {

        await interaction.deferReply({ ephemeral: true });

        const products = loadProducts();
        const nama = interaction.fields.getTextInputValue("nama_product");
        const jumlah = parseInt(
          interaction.fields.getTextInputValue("jumlah_product").replace(/\D/g, "")
        );
        const status = interaction.fields.getTextInputValue("status_product");
        const harga = parseInt(
          interaction.fields.getTextInputValue("harga_product").replace(/\D/g, "")
        );
        const link = interaction.fields.getTextInputValue("link_product") || null;

        if (isNaN(jumlah) || jumlah <= 0) {
          return interaction.editReply({ content: "❌ Jumlah harus angka dan lebih dari 0!" });
        }

        if (isNaN(harga) || harga <= 0) {
          return interaction.editReply({ content: "❌ Harga harus angka dan lebih dari 0!" });
        }

        const newId = generateProductId(products);
        const ownerName = interaction.user.username;
        const ownerId = interaction.user.id;

        products.push({ id: newId, nama, jumlah, status, harga, link, ownerName, ownerId });
        saveProducts(products);

        await mainshop.sendInitialShopMessage(client);

        await interaction.editReply({
          content: `✅ Product berhasil ditambahkan dengan ID ${newId}`
        });

        return true;
      }

      return false;
    }

    return false;
  }
};
