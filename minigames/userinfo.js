const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags
} = require("discord.js");
const trakteer = require("../utils/trakteer");

const ALLOWED_CHANNEL_IDS = [
  "1485965632573800568",
  "1483366304256884778"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View information about a user")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The user which you'd like to view information on")
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

      const member =
        interaction.guild?.members.cache.get(targetUser.id) ||
        (await interaction.guild?.members.fetch(targetUser.id).catch(() => null));

      const avatarURL = targetUser.displayAvatarURL({
        extension: "png",
        size: 256
      });

      const discordJoined = formatDiscordTimestamp(targetUser.createdAt);
      const serverJoined = member?.joinedAt
        ? formatDiscordTimestamp(member.joinedAt)
        : "Tidak diketahui";

      const totalDonate = Number(trakteer.getTotalDonate(targetUser.id) || 0);

      const embed = new EmbedBuilder()
        .setAuthor({
          name: targetUser.username,
          iconURL: avatarURL
        })
        .setThumbnail(avatarURL)
        .addFields(
          {
            name: "User Information",
            value: [
              `ID : ${targetUser.id}`,
              `Nama : ${targetUser.tag ?? targetUser.username}`,
              `Joined Discord : ${discordJoined}`
            ].join("\n"),
            inline: false
          },
          {
            name: "Member Information",
            value: [
              `Total Donate : ||Rp ${formatNumber(totalDonate)}||`,
              `Joined Server : ${serverJoined}`
            ].join("\n"),
            inline: false
          }
        );

      await interaction.reply({
        embeds: [embed]
      });
    } catch (error) {
      console.error("Userinfo command error:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Gagal menampilkan informasi user.",
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};

function formatDiscordTimestamp(date) {
  if (!date) return "Tidak diketahui";
  const unix = Math.floor(new Date(date).getTime() / 1000);
  return `<t:${unix}:F>`;
}

function formatNumber(number) {
  return new Intl.NumberFormat("id-ID").format(Number(number) || 0);
}