require("dotenv").config({ quiet: true });

const { REST, Routes } = require("discord.js");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in your .env file.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Clearing guild slash commands...");

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [],
    });

    console.log("Guild slash commands cleared successfully.");
  } catch (error) {
    console.error("Failed to clear slash commands:", error);
    process.exit(1);
  }
})();
