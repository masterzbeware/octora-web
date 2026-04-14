const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { Innertube, YTNodes } = require("youtubei.js");

const TARGET_CHANNEL_ID = "1445729691502641152";
const YOUTUBE_CHANNEL_ID = "UCecYCrt85AJiDSNT8sXOH7g";
const CHECK_INTERVAL = 60 * 1000;

let monitorStarted = false;
let lastNotifiedVideoId = null;
let lastNotificationMessageId = null;
let isCurrentlyLive = false;
let liveStartedAt = null;
let monitorInterval = null;
let youtube = null;

async function getYoutube() {
  if (!youtube) {
    youtube = await Innertube.create();
  }
  return youtube;
}

function pickBestThumbnail(thumbnails, videoId) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }

  const sorted = [...thumbnails].sort((a, b) => {
    const aSize = (a.width || 0) * (a.height || 0);
    const bSize = (b.width || 0) * (b.height || 0);
    return bSize - aSize;
  });

  return sorted[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "0m 0s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

async function fetchLiveVideo() {
  try {
    const yt = await getYoutube();
    const channel = await yt.getChannel(YOUTUBE_CHANNEL_ID);

    let liveTab;
    try {
      liveTab = await channel.getLiveStreams();
    } catch (err) {
      return null;
    }

    const videos = liveTab?.videos || [];
    if (!videos.length) return null;

    const liveVideo = videos.find((video) => {
      if (!(video instanceof YTNodes.Video)) return false;
      return video.is_live === true;
    });

    if (!liveVideo) return null;

    const videoId = liveVideo.id;
    if (!videoId) return null;

    const info = await yt.getInfo(videoId);
    const basicInfo = info?.basic_info || {};

    const isLiveNow =
      basicInfo?.is_live === true ||
      basicInfo?.is_live_content === true ||
      liveVideo.is_live === true;

    if (!isLiveNow) return null;

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: basicInfo.title || liveVideo.title?.toString() || "Modinner sedang live!",
      thumbnail: pickBestThumbnail(basicInfo.thumbnail, videoId)
    };
  } catch (err) {
    console.error("❌ Gagal cek live YouTube:", err);
    return null;
  }
}

async function sendLiveNotification(client, liveData) {
  try {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error("❌ Channel notifikasi live tidak ditemukan / bukan text channel.");
      return;
    }

    const embed = new EmbedBuilder()
      .setColor("#ff0033")
      .setAuthor({
        name: "modinner"
      })
      .setTitle(liveData.title || "ModInner sedang live")
      .setURL(liveData.url)
      .setImage(liveData.thumbnail)
      .addFields(
        {
          name: "Channel",
          value: "Modinner",
          inline: true
        },
        {
          name: "Status",
          value: "LIVE",
          inline: true
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Watch Now")
        .setStyle(ButtonStyle.Link)
        .setURL(liveData.url)
    );

    const sentMessage = await channel.send({
      content: "@everyone Modinner sedang live sekarang!",
      embeds: [embed],
      components: [row]
    });

    lastNotificationMessageId = sentMessage.id;
    liveStartedAt = Date.now();

    console.log(`✅ Notifikasi live terkirim: ${liveData.videoId}`);
  } catch (err) {
    console.error("❌ Gagal kirim notifikasi live:", err);
  }
}

async function editLiveEndedNotification(client) {
  try {
    if (!lastNotificationMessageId) return;

    const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages.fetch(lastNotificationMessageId).catch(() => null);
    if (!message) return;

    const durationText = formatDuration(Date.now() - (liveStartedAt || Date.now()));

    const endedEmbed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle("modinner LIVE Stream has Ended")
      .addFields({
        name: "Streaming Duration:",
        value: durationText,
        inline: false
      })
      .setTimestamp();

    await message.edit({
      content: null,
      embeds: [endedEmbed],
      components: []
    });

    console.log("✅ Embed live berhasil diubah menjadi ended.");
  } catch (err) {
    console.error("❌ Gagal edit embed saat live selesai:", err);
  }
}

async function checkYouTubeLive(client) {
  try {
    const liveData = await fetchLiveVideo();

    if (liveData) {
      if (!isCurrentlyLive || lastNotifiedVideoId !== liveData.videoId) {
        await sendLiveNotification(client, liveData);
        lastNotifiedVideoId = liveData.videoId;
      }

      isCurrentlyLive = true;
      return;
    }

    if (isCurrentlyLive) {
      console.log("ℹ️ Modinner sudah tidak live.");
      await editLiveEndedNotification(client);

      isCurrentlyLive = false;
      lastNotifiedVideoId = null;
      lastNotificationMessageId = null;
      liveStartedAt = null;
      return;
    }

    isCurrentlyLive = false;
  } catch (err) {
    console.error("❌ Error saat monitor live:", err);
  }
}

function startYouTubeLiveMonitor(client) {
  if (monitorStarted) return;
  monitorStarted = true;

  console.log("▶️ YouTube live monitor dimulai...");

  checkYouTubeLive(client);

  monitorInterval = setInterval(() => {
    checkYouTubeLive(client);
  }, CHECK_INTERVAL);
}

module.exports = {
  startYouTubeLiveMonitor
};