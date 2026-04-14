const { EmbedBuilder } = require("discord.js");

const LOG_CHANNEL_ID = "1471566751333355530";

async function sendDepositLog(client, userId, coinsAdded) {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle("💰 Deposit Log")
      .setDescription(
        `Thank you <@${userId}> for deposit **${coinsAdded} 🪙**`
      )
      .setColor(0x00ff99)
      .setTimestamp();

    await channel.send({ embeds: [embed] });

  } catch (err) {
    console.error("Error sendDepositLog:", err);
  }
}

module.exports = {
  sendDepositLog
};