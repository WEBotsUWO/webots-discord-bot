require("dotenv").config({ quiet: true });

const DISCORD_API_BASE = "https://discord.com/api/v10";

const COMPONENT_TYPES = {
  ACTION_ROW: 1,
  BUTTON: 2,
};

const BUTTON_STYLES = {
  PRIMARY: 1,
};

const CUSTOM_IDS = {
  startButton: "onboarding:start",
};

const { DISCORD_TOKEN, CLIENT_ID, WELCOME_CHANNEL_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !WELCOME_CHANNEL_ID) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID, or WELCOME_CHANNEL_ID in your .env file.");
  process.exit(1);
}

(async () => {
  try {
    const payload = buildWelcomeMessage();
    const messages = await discordRequest(`/channels/${WELCOME_CHANNEL_ID}/messages?limit=20`);
    const existingMessage = messages.find(
      (message) =>
        message.author?.id === CLIENT_ID &&
        message.components?.some((row) =>
          row.components?.some((component) => component.custom_id === CUSTOM_IDS.startButton),
        ),
    );

    if (existingMessage) {
      await discordRequest(`/channels/${WELCOME_CHANNEL_ID}/messages/${existingMessage.id}`, {
        method: "PATCH",
        body: payload,
      });
      console.log(`Updated existing onboarding message: ${existingMessage.id}`);
      return;
    }

    const message = await discordRequest(`/channels/${WELCOME_CHANNEL_ID}/messages`, {
      method: "POST",
      body: payload,
    });
    console.log(`Posted onboarding message: ${message.id}`);
  } catch (error) {
    console.error("Failed to post welcome onboarding message:", error);
    process.exit(1);
  }
})();

function buildWelcomeMessage() {
  return {
    embeds: [
      {
        title: "Welcome to the Humanoid Robotics Club",
        description: [
          "We are glad you are here. Start onboarding to set your display name, choose your main team, and unlock the rest of the server.",
          "",
          "Pick the team that best matches where you want to contribute right now. You can ask a lead or admin to change it later.",
        ].join("\n"),
        color: 0x2f80ed,
        footer: { text: "University humanoid robotics club onboarding" },
      },
    ],
    components: [
      {
        type: COMPONENT_TYPES.ACTION_ROW,
        components: [
          {
            type: COMPONENT_TYPES.BUTTON,
            custom_id: CUSTOM_IDS.startButton,
            label: "Start Onboarding",
            style: BUTTON_STYLES.PRIMARY,
          },
        ],
      },
    ],
  };
}

async function discordRequest(path, options = {}) {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${DISCORD_TOKEN}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const details = data?.message ? `${data.message}${data.code ? ` (${data.code})` : ""}` : response.statusText;
    throw new Error(`Discord API ${response.status} ${options.method ?? "GET"} ${path}: ${details}`);
  }

  return data;
}
