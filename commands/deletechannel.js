module.exports = {
  async handleInteraction(interaction) {
    // Pastikan ini tombol Selesai
    if (!interaction.isButton()) return false;
    if (interaction.customId !== "order_selesai") return false;

    try {
      // Optional: cek apakah channel ada topic buyer:
      const channel = interaction.channel;

      if (!channel) return false;

      // Delay 3 detik biar sempat kebaca
      setTimeout(async () => {
        try {
          await channel.delete();
        } catch (err) {
          console.error("Gagal menghapus channel:", err);
        }
      }, 3000);

      return true;

    } catch (err) {
      console.error("Error tombol selesai:", err);
      return false;
    }
  }
};