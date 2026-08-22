require("dotenv").config({ quiet: true });

const fs = require("node:fs/promises");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const ORG_CHANNEL_NAME = "org-structure";
const ORG_POST_HEADING = "# WeBots / CHRC Org Structure";
const MARKDOWN_PATH = path.join(process.cwd(), "content", "org-structure.md");
const PREVIEW_PATH = path.join(process.cwd(), "assets", "org-structure-preview.png");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, ORG_STRUCTURE_CHANNEL_ID, ORG_STRUCTURE_URL } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in your .env file.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    const channelId = ORG_STRUCTURE_CHANNEL_ID || (await findChannelIdByName(ORG_CHANNEL_NAME));
    const content = await buildMessageContent();
    const chartFile = await buildChartFile();

    await deletePreviousOrgPosts(channelId);
    const message = await postMessage(channelId, content, chartFile);

    console.log(`Posted org structure in #${ORG_CHANNEL_NAME}: ${message.id}`);
  } catch (error) {
    console.error("Could not post org structure:", formatDiscordError(error));
    process.exit(1);
  }
})();

async function findChannelIdByName(channelName) {
  const channels = await rest.get(Routes.guildChannels(GUILD_ID));
  const channel = channels.find((item) => item.name === channelName);

  if (!channel) {
    throw new Error(`Could not find #${channelName}. Set ORG_STRUCTURE_CHANNEL_ID in .env if the channel has a different name.`);
  }

  return channel.id;
}

async function deletePreviousOrgPosts(channelId) {
  const messages = await rest.get(Routes.channelMessages(channelId), {
    query: new URLSearchParams({ limit: "50" }),
  });

  const previousPosts = messages.filter((message) => {
    const hasOrgHeading = message.content?.startsWith(ORG_POST_HEADING);
    const hasOrgAttachment = message.attachments?.some((attachment) => attachment.filename?.startsWith("webots-org-structure"));
    return message.author?.id === CLIENT_ID && (hasOrgHeading || hasOrgAttachment);
  });

  for (const message of previousPosts) {
    await rest.delete(Routes.channelMessage(channelId, message.id));
    console.log(`Deleted previous org structure post: ${message.id}`);
  }
}

async function buildChartFile() {
  const data = await fs.readFile(PREVIEW_PATH);

  return {
    data,
    filename: "webots-org-structure-preview.png",
    contentType: "image/png",
  };
}

async function buildMessageContent() {
  const base = (await fs.readFile(MARKDOWN_PATH, "utf8")).trimEnd();
  const link = ORG_STRUCTURE_URL || "Set ORG_STRUCTURE_URL in .env after deploying the interactive chart.";

  return `${base}\n${link}`;
}

async function postMessage(channelId, content, chartFile) {
  const form = new FormData();
  const payload = {
    content,
    allowed_mentions: { parse: [] },
  };

  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([chartFile.data], { type: chartFile.contentType }), chartFile.filename);

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
    },
    body: form,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message ?? `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }

  return body;
}

function formatDiscordError(error) {
  if (error.code === 50001) {
    return "Missing Access. Give the bot View Channel and Send Messages in #org-structure.";
  }

  if (error.code === 50013) {
    return "Missing Permissions. Give the bot View Channel, Send Messages, Attach Files, and Read Message History in #org-structure.";
  }

  return `${error.code ?? error.status ?? "unknown"} ${error.message ?? error}`;
}
