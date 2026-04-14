const { REST, Routes } = require("discord.js");
const { clientId, guildId, token } = require("./config.json");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    if (!command.data || !command.data.name) {
        console.warn(`⚠️ File ${file} tidak memiliki properti 'data' atau 'name', dilewati.`);
        continue;
    }

    console.log(`✅ Memuat command: ${command.data.name}`);
    commands.push(command.data.toJSON());
}

// Inisialisasi REST API Discord
const rest = new REST({ version: "10" }).setToken(token);

// Deploy command ke server Discord
(async () => {
    try {
        console.log(`🚀 Memulai deploy ${commands.length} perintah ke server (Guild ID: ${guildId})...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`✅ Berhasil mengupload ${data.length} perintah!`);
    } catch (error) {
        console.error("❌ Terjadi kesalahan saat deploy perintah:", error);
    }
})();
