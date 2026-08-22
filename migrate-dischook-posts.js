require("dotenv").config({ quiet: true });

const fs = require("node:fs/promises");
const path = require("node:path");
const { REST, Routes } = require("discord.js");

const TARGET_CHANNEL_NAMES = [
  "mission-statement",
  "new-competition",
  "our-values",
  "our-vision",
  "project-josh",
];

const APPLY_CHANGES = process.argv.includes("--apply");

const { DISCORD_TOKEN, GUILD_ID, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !GUILD_ID || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN, GUILD_ID, or CLIENT_ID in your .env file.");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    const guildChannels = await rest.get(Routes.guildChannels(GUILD_ID));
    const channelById = new Map(guildChannels.map((channel) => [channel.id, channel]));
    const channelByName = new Map(guildChannels.map((channel) => [channel.name, channel]));
    const targetChannels = getTargetChannels(channelByName);
    const { webhooks: guildWebhooks, canManageWebhooks } = await getGuildWebhooks();
    const webhookById = new Map(guildWebhooks.map((webhook) => [webhook.id, webhook]));

    const archive = {
      migratedAt: new Date().toISOString(),
      guildId: GUILD_ID,
      source: "dischook-webhook-migration",
      posts: [],
    };

    for (const channel of targetChannels) {
      const post = await getLatestWebhookPost(channel);
      const webhook = webhookById.get(post.webhook_id);
      const sourceChannel = channelById.get(webhook?.channel_id ?? channel.id);

      archive.posts.push({
        channelName: channel.name,
        channelId: channel.id,
        sourceWebhookId: post.webhook_id,
        sourceWebhookName: webhook?.name ?? post.author?.username ?? "unknown",
        sourceMessageId: post.id,
        sourceChannelName: sourceChannel?.name ?? null,
        sourceMessage: normalizeMessageForArchive(post),
      });
    }

    ensureReadableArchive(archive);

    const archivePath = await writeArchive(archive);
    console.log(`Archived webhook posts to ${archivePath}`);

    if (!APPLY_CHANGES) {
      console.log("Dry run complete. Rerun with `npm run migrate:dischook -- --apply` to repost and delete webhooks.");
      return;
    }

    if (!canManageWebhooks) {
      throw new Error("The bot needs Manage Webhooks permission before it can delete Dischook webhooks.");
    }

    for (const post of archive.posts) {
      const payload = buildBotPayload(post, channelByName);
      const newMessage = await rest.post(Routes.channelMessages(post.channelId), {
        body: payload,
      });
      console.log(`Posted bot copy in #${post.channelName}: ${newMessage.id}`);

      await deleteOriginalWebhookMessage(post).catch((error) => {
        console.warn(`Could not delete old webhook message in #${post.channelName}: ${formatDiscordError(error)}`);
      });
    }

    await deleteTargetWebhooks(guildWebhooks, targetChannels).catch((error) => {
      console.warn(`Could not delete one or more webhooks: ${formatDiscordError(error)}`);
    });

    console.log("Dischook migration finished.");
  } catch (error) {
    console.error("Dischook migration failed:", error.message || error);
    process.exit(1);
  }
})();

function getTargetChannels(channelByName) {
  return TARGET_CHANNEL_NAMES.map((name) => {
    const channel = channelByName.get(name);

    if (!channel) {
      throw new Error(`Could not find #${name}.`);
    }

    return channel;
  });
}

async function getGuildWebhooks() {
  try {
    const webhooks = await rest.get(Routes.guildWebhooks(GUILD_ID));
    return { webhooks, canManageWebhooks: true };
  } catch (error) {
    if (error.code === 50013) {
      console.warn("The bot needs Manage Webhooks permission before it can list or delete Dischook webhooks.");
      return { webhooks: [], canManageWebhooks: false };
    }

    throw error;
  }
}

async function getLatestWebhookPost(channel) {
  const messages = await rest.get(Routes.channelMessages(channel.id), {
    query: new URLSearchParams({ limit: "50" }),
  });
  const webhookMessages = messages.filter((message) => message.webhook_id);

  if (webhookMessages.length === 0) {
    throw new Error(`Could not find a webhook-authored post in #${channel.name}.`);
  }

  return webhookMessages[0];
}

function normalizeMessageForArchive(message) {
  return {
    content: message.content ?? "",
    embeds: message.embeds ?? [],
    attachments: message.attachments ?? [],
    components: message.components ?? [],
    allowedMentions: { parse: [] },
  };
}

function ensureReadableArchive(archive) {
  const emptyPosts = archive.posts.filter((post) => {
    const message = post.sourceMessage;
    return (
      !message.content &&
      message.embeds.length === 0 &&
      message.attachments.length === 0 &&
      message.components.length === 0
    );
  });

  if (emptyPosts.length === 0) {
    return;
  }

  const names = emptyPosts.map((post) => `#${post.channelName}`).join(", ");
  throw new Error(
    [
      `Discord returned empty message bodies for: ${names}.`,
      "I will not delete or replace those posts until I can copy them word for word.",
      "Enable Message Content Intent for this bot in the Discord Developer Portal, then rerun this command.",
    ].join(" "),
  );
}

async function writeArchive(archive) {
  const archiveDir = path.join(process.cwd(), "archives");
  await fs.mkdir(archiveDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = path.join(archiveDir, `dischook-posts-${timestamp}.json`);
  await fs.writeFile(archivePath, JSON.stringify(archive, null, 2));

  return archivePath;
}

function buildBotPayload(post, channelByName) {
  const source = post.sourceMessage;
  const payload = {
    content: post.channelName === "mission-statement" ? updateMissionStatementText(source.content, channelByName) : source.content,
    embeds: updateMissionStatementEmbeds(post.channelName, source.embeds, channelByName),
    components: source.components,
    allowed_mentions: { parse: [] },
  };

  if (payload.embeds.length === 0) {
    delete payload.embeds;
  }

  if (payload.components.length === 0) {
    delete payload.components;
  }

  return payload;
}

function updateMissionStatementEmbeds(channelName, embeds, channelByName) {
  if (channelName !== "mission-statement") {
    return embeds;
  }

  return replaceStringsDeep(embeds, (value) => updateMissionStatementText(value, channelByName));
}

function updateMissionStatementText(value, channelByName) {
  const newCompetitionChannel = channelByName.get("new-competition");
  const newCompetitionMention = newCompetitionChannel ? `<#${newCompetitionChannel.id}>` : "#new-competition";
  const replacement = `starting, and competing in our ${newCompetitionMention}`;

  return value
    .replace(/starting\s+a?\s*(?:<#\d+>|#?unknown|#?new-comp(?:etition)?)[^.!\n]*(?=[.!\n]|$)/gi, replacement)
    .replace(/starting\s+(?:<#\d+>|#?unknown|#?new-comp(?:etition)?)[^.!\n]*(?=[.!\n]|$)/gi, replacement)
    .replace(/starting\s+in\s+(?:<#\d+>|#?unknown)[^.!\n]*(?=[.!\n]|$)/gi, replacement);
}

function replaceStringsDeep(value, replacer) {
  if (typeof value === "string") {
    return replacer(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceStringsDeep(item, replacer));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStringsDeep(item, replacer)]));
  }

  return value;
}

async function deleteOriginalWebhookMessage(post) {
  await rest.delete(Routes.channelMessage(post.channelId, post.sourceMessageId));
  console.log(`Deleted old webhook message in #${post.channelName}: ${post.sourceMessageId}`);
}

async function deleteTargetWebhooks(guildWebhooks, targetChannels) {
  const targetChannelIds = new Set(targetChannels.map((channel) => channel.id));
  const targetWebhooks = guildWebhooks.filter(
    (webhook) => targetChannelIds.has(webhook.channel_id) && webhook.name?.toLowerCase() === "webot",
  );

  for (const webhook of targetWebhooks) {
    await rest.delete(Routes.webhook(webhook.id));
    console.log(`Deleted webhook ${webhook.name} (${webhook.id})`);
  }
}

function formatDiscordError(error) {
  return `${error.code ?? error.status ?? "unknown"} ${error.message ?? error}`;
}
