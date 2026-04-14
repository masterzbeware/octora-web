const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const LOG_CHANNEL = "1445720171045191862";
const MODLOG_CHANNEL = "1445720171045191862";

const STAFF_ROLES = [
  "1272533427857522719",
  "1349238330499268628"
];

// SIMPAN RELASI TICKET THREAD → LOG THREAD
const ticketLogs = new Map();

module.exports = {
  data: { name: "sendlogging" },
  ticketLogs,

async sendLog(client, message, thread, ticketNumber) {

  const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
  if (!channel) return;

  const tanggal = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `Channel Bantuan - #${ticketNumber}`
    })
    .setDescription(
      `Halo! <@&1272533427857522719> <@&1349238330499268628> <@&1382283850348105788>\n` +
      `Ticket baru telah dibuat, silakan tekan tombol di bawah ini untuk menerima atau menolak ticket ini.`
    )
.addFields(
  {
    name: "Ticket Number",
    value: `#${ticketNumber}`,
    inline: true
  },
  {
    name: "Author",
    value: `${message.author}`,
    inline: true
  },
  {
    name: "Server Discord",
    value: message.guild.name,
    inline: true
  },
  {
    name: "Chat From Player",
    value: message.content || "Tidak ada pesan.",
    inline: true
  },
  {
    name: "Role Player",
    value: message.member.roles.highest.toString(),
    inline: true
  },
  {
    name: "Tanggal",
    value: tanggal,
    inline: true
  },
  {
    name: "Handle by",
    value: "-",
    inline: true
  },
  {
    name: "Status",
    value: "🟢 Open",
    inline: true
  }
)
    .setColor(0x4dffe1);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_accept|${thread.id}|${ticketNumber}|${message.author.id}`)
      .setLabel("Terima")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`ticket_reject|${thread.id}`)
      .setLabel("Tolak")
      .setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  });
},

async handleInteraction(interaction) {

  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("ticket_")) return false;

  const hasRole = interaction.member.roles.cache.some(role =>
    STAFF_ROLES.includes(role.id)
  );

  if (!hasRole) {
    await interaction.reply({
      content: "❌ Kamu tidak punya permission.",
      ephemeral: true
    });
    return true;
  }

  const parts = interaction.customId.split("|");
  const action = parts[0].split("_")[1];

// ================== ACCEPT ==================
if (action === "accept") {

  const threadId = parts[1];
  const ticketNumber = parts[2];
  const userId = parts[3];

  const thread = await interaction.guild.channels.fetch(threadId).catch(() => null);
  if (!thread) return true;

  const member = await interaction.guild.members.fetch(userId);
  const format = ticketNumber.toString().padStart(2, "0");

await thread.setName(
  `${member.user.username} - ${format} [${interaction.user.username}]`
);

// ================== UPDATE EMBED DI THREAD TICKET ==================
const messages = await thread.messages.fetch({ limit: 10 });

const botMessage = messages.find(
  m => m.author.id === interaction.client.user.id && m.embeds.length > 0
);

if (botMessage) {

  const oldEmbed = botMessage.embeds[0];
  const newEmbed = EmbedBuilder.from(oldEmbed);

  // index 4 = Handle by
  newEmbed.data.fields[4].value = `${interaction.user}`;

  await botMessage.edit({
    embeds: [newEmbed]
  });

}

  // ================== BUAT THREAD LOG MODERATOR ==================
  const logChannel = await interaction.client.channels.fetch(MODLOG_CHANNEL).catch(() => null);
  if (logChannel) {

    const logThread = await logChannel.threads.create({
      name: `ticket-log-${ticketNumber}`,
      autoArchiveDuration: 1440,
      reason: "Moderator ticket log"
    });

    await logThread.send({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: `Moderator Log | Ticket #${ticketNumber}`
          })
          .setDescription(`Thread ini mencatat semua pesan moderator dari ticket #${ticketNumber}.`)
          .setColor(0x4dffe1)
      ]
    });

    ticketLogs.set(thread.id, logThread.id);
  }

  // ================== UPDATE EMBED ==================
  const oldEmbed = interaction.message.embeds[0];
  const newEmbed = EmbedBuilder.from(oldEmbed);

  newEmbed.data.fields[6].value = `${interaction.user}`;
  newEmbed.data.fields[7].value = "🟡 Handling";

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close|${thread.id}|${interaction.user.id}`)
      .setLabel("Tutup")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [newEmbed],
    components: [closeRow]
  });

  return true;
}

  // ================== REJECT ==================
  if (action === "reject") {

    const threadId = parts[1];

    const thread = await interaction.guild.channels.fetch(threadId).catch(() => null);
    if (!thread) return true;

    await thread.setArchived(true);

    await interaction.update({
      content: `❌ Ticket ditolak oleh ${interaction.user}`,
      embeds: [],
      components: []
    });

    return true;
  }

// ================== CLOSE ==================
if (action === "close") {

  const threadId = parts[1];
  const handlerId = parts[2];

  if (interaction.user.id !== handlerId) {
    await interaction.reply({
      content: "❌ Hanya moderator yang menerima ticket ini yang bisa menutupnya.",
      flags: 64
    });
    return true;
  }

  const thread = await interaction.guild.channels.fetch(threadId).catch(() => null);
  if (!thread) return true;

  const oldEmbed = interaction.message.embeds[0];
  const newEmbed = EmbedBuilder.from(oldEmbed);

  // ubah status menjadi closed
  newEmbed.data.fields[7].value = "🔴 Closed";

  await interaction.update({
    embeds: [newEmbed],
    components: []
  });

  // ambil log thread dari map
  const logThreadId = ticketLogs.get(thread.id);

  // hapus ticket thread + log thread setelah 3 detik
  setTimeout(async () => {
    try {
      if (logThreadId) {
        const logThread = await interaction.guild.channels.fetch(logThreadId).catch(() => null);
        if (logThread) {
          await logThread.delete().catch(() => null);
        }

        ticketLogs.delete(thread.id);
      }

      await thread.delete().catch(() => null);
    } catch (err) {
      console.error("Gagal menghapus ticket/log thread:", err);
    }
  }, 3000);

  return true;
}

  return false;
}

};