const { EmbedBuilder } = require("discord.js");
const { ticketLogs } = require("./sendlogging");

async function handleMessage(client, message) {

  if (message.author.bot) return;
  if (!message.channel.isThread()) return;

  const threadId = message.channel.id;

  // ================= PLAYER → LOG =================
  const logThreadId = ticketLogs.get(threadId);

  if (logThreadId) {

    const logThread = await message.guild.channels.fetch(logThreadId).catch(() => null);
    if (!logThread) return;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Message By Player | ${message.author.username}`
      })
      .setDescription(message.content || "*No message*")
      .setColor(0x4dffe1);

    await logThread.send({ embeds: [embed] });

    return;
  }

  // ================= MODERATOR → PLAYER =================
  const ticketEntry = [...ticketLogs.entries()].find(
    ([ticketId, logId]) => logId === threadId
  );

  if (ticketEntry) {

    const ticketThreadId = ticketEntry[0];

    const ticketThread = await message.guild.channels.fetch(ticketThreadId).catch(() => null);
    if (!ticketThread) return;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Message By Moderator | ${message.author.username}`
      })
      .setDescription(message.content || "*No message*")
      .setColor(0x4dffe1);

    await ticketThread.send({ embeds: [embed] });

  }

}

module.exports = { handleMessage };