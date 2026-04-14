const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const CHANNEL_ID = "1483052624084336710";
const COUNTER_PATH = path.join(__dirname, "../database/ticketCounter.json");

function ensureCounterFile() {
  if (!fs.existsSync(COUNTER_PATH)) {
    fs.writeFileSync(
      COUNTER_PATH,
      JSON.stringify({ lastTicket: 0 }, null, 2)
    );
  }
}

function getNextTicket() {
  ensureCounterFile();

  const data = JSON.parse(fs.readFileSync(COUNTER_PATH, "utf8"));

  data.lastTicket += 1;

  fs.writeFileSync(COUNTER_PATH, JSON.stringify(data, null, 2));

  return data.lastTicket;
}

module.exports = {
  data: { name: "ticket" },

  async handleMessage(message) {
    if (message.author.bot) return;
    if (message.channel.id !== CHANNEL_ID) return;

    try {
      const ticketNumber = getNextTicket();
      const ticketFormat = ticketNumber.toString().padStart(2, "0");

      const thread = await message.startThread({
        name: `Channel Bantuan - ${ticketFormat}`,
        autoArchiveDuration: 1440
      });

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `Channel Bantuan - ${ticketFormat}`
        })
        .setDescription(
          `Terima kasih ${message.author} telah menghubungi tim support!\n` +
          `Mohon tunggu dengan sabar sampai salah satu dari tim support membantu Anda.`
        )
        .addFields(
          { name: "Ticket Number", value: `#${ticketFormat}`, inline: true },
          { name: "Author", value: `${message.author}`, inline: true },
          { name: "Server Discord", value: message.guild.name, inline: true },
          {
            name: "Chat From Player",
            value: message.content || "Tidak ada pesan.",
            inline: false
          },
          {
            name: "Handle by",
            value: "Belum ada admin yang menangani",
            inline: false
          }
        )
        .setColor(0x4dffe1);

      await thread.send({ embeds: [embed] });

      // ================== KIRIM LOG ==================
      const sendlogging = message.client.commands.get("sendlogging");
      if (sendlogging?.sendLog) {
        await sendlogging.sendLog(
          message.client,
          message,
          thread,
          ticketFormat
        );
      }

      await message.delete().catch(() => {});
    } catch (err) {
      console.error("Ticket error:", err);
    }
  }
};