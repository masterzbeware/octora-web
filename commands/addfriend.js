const { 
  SlashCommandBuilder, 
  EmbedBuilder 
} = require("discord.js");

const TARGET_CHANNEL_ID = "1445721163669180538";
const ALLOWED_ROLE_ID = "1272533427857522719";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addfriend")
    .setDescription("Menambahkan teman")
    .addStringOption(option =>
      option
        .setName("username")
        .setDescription("Username yang ingin di add")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const member = interaction.member;

      // ❌ CEK ROLE
      if (!member.roles.cache.has(ALLOWED_ROLE_ID)) {
        return interaction.reply({
          content: "❌ Kamu tidak punya izin untuk menggunakan command ini!",
          flags: 64
        });
      }

      const username = interaction.options.getString("username");

      const channel = await interaction.client.channels
        .fetch(TARGET_CHANNEL_ID)
        .catch(() => null);

      if (!channel) {
        return interaction.reply({
          content: "❌ Channel tidak ditemukan!",
          flags: 64
        });
      }

      const embed = new EmbedBuilder()
        .setColor("#00ff99")
        .setTitle("✅ Add Friend Berhasil")
        .setDescription(`Berhasil melakukan add friend ke **${username}**`)
        .setFooter({
          text: `Dilakukan oleh ${interaction.user.username}`
        })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Berhasil add friend ke ${username}`,
        flags: 64
      });

    } catch (err) {
      console.error("AddFriend Error:", err);

      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Terjadi error saat add friend!",
          flags: 64
        });
      }
    }
  }
};