import nacl from "tweetnacl";

const DISCORD_API_BASE = "https://discord.com/api/v10";

const INTERACTION_TYPES = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
};

const RESPONSE_TYPES = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
};

const COMPONENT_TYPES = {
  ACTION_ROW: 1,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
};

const TEXT_INPUT_STYLES = {
  SHORT: 1,
};

const MESSAGE_FLAGS = {
  EPHEMERAL: 64,
};

const PERMISSIONS = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
};

const TEAM_ROLES = ["Mechanical", "Electrical", "Software", "Comp", "Business"];
const REQUIRED_ROLE_NAMES = ["Member", ...TEAM_ROLES];

const CUSTOM_IDS = {
  startButton: "onboarding:start",
  nameModal: "onboarding:name-modal",
  nameInput: "onboarding:name-input",
  teamSelect: "onboarding:team-select",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return textResponse("Discord onboarding Worker is running.");
    }

    if (request.method !== "POST") {
      return textResponse("Method not allowed.", 405);
    }

    if (!env.DISCORD_TOKEN || !env.PUBLIC_KEY || !env.CLIENT_ID) {
      console.error("Missing DISCORD_TOKEN, PUBLIC_KEY, or CLIENT_ID Worker secret.");
      return textResponse("Worker is missing required Discord secrets.", 500);
    }

    const rawBody = await request.text();

    if (!verifyDiscordRequest(request, rawBody, env.PUBLIC_KEY)) {
      return textResponse("Invalid request signature.", 401);
    }

    const interaction = JSON.parse(rawBody);

    try {
      return await handleInteraction(interaction, env, ctx);
    } catch (error) {
      console.error("Interaction handling failed:", error);
      return interactionMessage("Something went wrong. Please ask an admin to check the Cloudflare Worker logs.");
    }
  },
};

async function handleInteraction(interaction, env, ctx) {
  if (interaction.type === INTERACTION_TYPES.PING) {
    return interactionResponse({ type: RESPONSE_TYPES.PONG });
  }

  if (interaction.type === INTERACTION_TYPES.APPLICATION_COMMAND) {
    return interactionMessage("This bot no longer uses slash commands. Please use the onboarding button in #welcome.");
  }

  if (interaction.type === INTERACTION_TYPES.MESSAGE_COMPONENT) {
    if (interaction.data?.custom_id === CUSTOM_IDS.startButton) {
      return interactionResponse(buildNameModalResponse());
    }

    if (interaction.data?.custom_id === CUSTOM_IDS.teamSelect) {
      return handleTeamSelect(interaction, env, ctx);
    }
  }

  if (interaction.type === INTERACTION_TYPES.MODAL_SUBMIT && interaction.data?.custom_id === CUSTOM_IDS.nameModal) {
    return handleNameSubmit(interaction, env);
  }

  return interactionMessage("I do not know how to handle that interaction.");
}

async function handleNameSubmit(interaction, env) {
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const preferredName = getModalValue(interaction, CUSTOM_IDS.nameInput)?.trim();

  if (!guildId || !userId) {
    return interactionMessage("Onboarding must be completed inside the Discord server.");
  }

  if (!preferredName) {
    return interactionMessage("Please enter a name before continuing.");
  }

  let nicknameNote = "";

  try {
    await ensureBotCan(env, guildId, PERMISSIONS.MANAGE_NICKNAMES, "Manage Nicknames");
    await discordRequest(env, `/guilds/${guildId}/members/${userId}`, {
      method: "PATCH",
      body: { nick: preferredName },
      reason: "Robotics club onboarding name",
    });
    console.log(`Updated nickname for ${userId} to ${preferredName}.`);
  } catch (error) {
    console.error(`Could not update nickname for ${userId}:`, error);
    nicknameNote = "I could not update your nickname. My role may need Manage Nicknames and a high enough role.\n\n";
  }

  return interactionResponse({
    type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `${nicknameNote}Thanks. Now choose your main team.`,
      components: [buildTeamSelectRow()],
      flags: MESSAGE_FLAGS.EPHEMERAL,
    },
  });
}

async function handleTeamSelect(interaction, env, ctx) {
  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const selectedTeam = interaction.data?.values?.[0];

  if (!guildId || !userId) {
    return interactionMessage("Onboarding must be completed inside the Discord server.");
  }

  if (!TEAM_ROLES.includes(selectedTeam)) {
    return interactionMessage("That team is not available.");
  }

  const allRoles = await discordRequest(env, `/guilds/${guildId}/roles`);
  const rolesById = new Map(allRoles.map((role) => [role.id, role]));
  const rolesByName = new Map(REQUIRED_ROLE_NAMES.map((roleName) => [roleName, findRole(allRoles, roleName)]));
  const missingRoles = REQUIRED_ROLE_NAMES.filter((roleName) => !rolesByName.get(roleName));

  if (missingRoles.length > 0) {
    return interactionMessage(
      `These onboarding roles do not exist yet: ${missingRoles.join(", ")}. Please create them in Server Settings > Roles.`,
    );
  }

  const botMember = await discordRequest(env, `/guilds/${guildId}/members/${env.CLIENT_ID}`);
  const botPermissions = calculateMemberPermissions(rolesById, botMember, guildId);

  if (!hasPermission(botPermissions, PERMISSIONS.MANAGE_ROLES)) {
    return interactionMessage("I need Manage Roles permission before I can finish onboarding.");
  }

  const selectedRole = rolesByName.get(selectedTeam);
  const memberRole = rolesByName.get("Member");
  const currentRoleIds = new Set(interaction.member?.roles ?? []);
  const rolesToRemove = TEAM_ROLES.filter((roleName) => roleName !== selectedTeam)
    .map((roleName) => rolesByName.get(roleName))
    .filter((role) => currentRoleIds.has(role.id));
  const unmanageableRoles = getUnmanageableRoleNames(rolesById, botMember, [selectedRole, memberRole, ...rolesToRemove]);

  if (unmanageableRoles.length > 0) {
    return interactionMessage(
      `I cannot manage these roles yet: ${unmanageableRoles.join(", ")}. Please move my bot role above them.`,
    );
  }

  try {
    await Promise.all([
      ...rolesToRemove.map((role) =>
        discordRequest(env, `/guilds/${guildId}/members/${userId}/roles/${role.id}`, {
          method: "DELETE",
          reason: "Mutually exclusive onboarding team selection",
        }),
      ),
      discordRequest(env, `/guilds/${guildId}/members/${userId}/roles/${selectedRole.id}`, {
        method: "PUT",
        reason: "Completed robotics club onboarding",
      }),
      discordRequest(env, `/guilds/${guildId}/members/${userId}/roles/${memberRole.id}`, {
        method: "PUT",
        reason: "Completed robotics club onboarding",
      }),
    ]);
  } catch (error) {
    console.error(`Could not update onboarding roles for ${userId}:`, error);
    return interactionMessage("I could not update your roles. Please ask an admin to check my permissions and role position.");
  }

  if (env.NEW_MEMBER_WELCOME_CHANNEL_ID) {
    ctx.waitUntil(
      postNewMemberWelcome(env, userId).catch((error) => {
        console.error(`Could not post new member welcome for ${userId}:`, error);
      }),
    );
  }

  console.log(`${userId} completed onboarding as ${selectedTeam}.`);

  return interactionResponse({
    type: RESPONSE_TYPES.UPDATE_MESSAGE,
    data: {
      content: `Onboarding complete. You are now a Member on the ${selectedTeam} team, and the rest of the server is unlocked.`,
      components: [],
    },
  });
}

async function postNewMemberWelcome(env, userId) {
  await discordRequest(env, `/channels/${env.NEW_MEMBER_WELCOME_CHANNEL_ID}/messages`, {
    method: "POST",
    body: {
      content: buildNewMemberWelcomeMessage(env, userId),
      allowed_mentions: {
        parse: ["users"],
      },
    },
  });
}

function buildNewMemberWelcomeMessage(env, userId) {
  const codeOfConduct = channelMention(env.CODE_OF_CONDUCT_CHANNEL_ID, "code-of-conduct");
  const questions = channelMention(env.QUESTIONS_CHANNEL_ID, "questions-answers");
  const missionStatement = channelMention(env.MISSION_STATEMENT_CHANNEL_ID, "mission-statement");
  const staffMentions = [env.SETH_USER_ID, env.ALEKS_USER_ID, env.JAYLEN_USER_ID]
    .filter(Boolean)
    .map((staffUserId) => `<@${staffUserId}>`);
  const staffText = staffMentions.length > 0 ? joinStaffMentions(staffMentions) : "@seth, @aleks, or @jaylen";

  return [
    `Welcome to WeBots, <@${userId}>! We meet every week on Thursday at 7:00pm in Aceb-3435. You can join anytime!`,
    "",
    "In the meantime, to get started:",
    `- read the ${codeOfConduct}`,
    `- ask questions in ${questions}`,
    `- learn about our mission under ${missionStatement}`,
    "",
    `If you need anything else, reach out to ${staffText}.`,
    "Excited to have you on board!",
  ].join("\n");
}

function channelMention(channelId, fallbackName) {
  return channelId ? `<#${channelId}>` : fallbackName;
}

function joinStaffMentions(mentions) {
  if (mentions.length === 1) {
    return mentions[0];
  }

  if (mentions.length === 2) {
    return `${mentions[0]} or ${mentions[1]}`;
  }

  return `${mentions.slice(0, -1).join(", ")}, or ${mentions.at(-1)}`;
}

async function ensureBotCan(env, guildId, permission, permissionName) {
  const roles = await discordRequest(env, `/guilds/${guildId}/roles`);
  const botMember = await discordRequest(env, `/guilds/${guildId}/members/${env.CLIENT_ID}`);
  const permissions = calculateMemberPermissions(new Map(roles.map((role) => [role.id, role])), botMember, guildId);

  if (!hasPermission(permissions, permission)) {
    throw new Error(`Bot is missing ${permissionName}.`);
  }
}

function buildNameModalResponse() {
  return {
    type: RESPONSE_TYPES.MODAL,
    data: {
      custom_id: CUSTOM_IDS.nameModal,
      title: "Start Onboarding",
      components: [
        {
          type: COMPONENT_TYPES.ACTION_ROW,
          components: [
            {
              type: COMPONENT_TYPES.TEXT_INPUT,
              custom_id: CUSTOM_IDS.nameInput,
              label: "Real or preferred name",
              placeholder: "Example: Alex Chen",
              required: true,
              min_length: 2,
              max_length: 32,
              style: TEXT_INPUT_STYLES.SHORT,
            },
          ],
        },
      ],
    },
  };
}

function buildTeamSelectRow() {
  return {
    type: COMPONENT_TYPES.ACTION_ROW,
    components: [
      {
        type: COMPONENT_TYPES.STRING_SELECT,
        custom_id: CUSTOM_IDS.teamSelect,
        placeholder: "Choose your main team",
        min_values: 1,
        max_values: 1,
        options: TEAM_ROLES.map((roleName) => ({
          label: roleName,
          value: roleName,
        })),
      },
    ],
  };
}

function getModalValue(interaction, customId) {
  for (const row of interaction.data?.components ?? []) {
    for (const component of row.components ?? []) {
      if (component.custom_id === customId) {
        return component.value;
      }
    }
  }

  return null;
}

function findRole(roles, roleName) {
  return roles.find((role) => role.name === roleName);
}

function calculateMemberPermissions(rolesById, member, guildId) {
  let permissions = BigInt(rolesById.get(guildId)?.permissions ?? 0);

  for (const roleId of member?.roles ?? []) {
    permissions |= BigInt(rolesById.get(roleId)?.permissions ?? 0);
  }

  return permissions;
}

function getUnmanageableRoleNames(rolesById, botMember, roles) {
  const botHighestPosition = getHighestRolePosition(rolesById, botMember);

  return roles
    .filter(Boolean)
    .filter((role) => role.managed || Number(role.position) >= botHighestPosition)
    .map((role) => role.name);
}

function getHighestRolePosition(rolesById, member) {
  return Math.max(0, ...(member?.roles ?? []).map((roleId) => Number(rolesById.get(roleId)?.position ?? 0)));
}

function hasPermission(permissionBits, permission) {
  const permissions = BigInt(permissionBits ?? 0);
  return (permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR || (permissions & permission) === permission;
}

async function discordRequest(env, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bot ${env.DISCORD_TOKEN}`,
  };

  if (options.reason) {
    headers["X-Audit-Log-Reason"] = encodeURIComponent(options.reason);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${DISCORD_API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (response.status === 429) {
      const rateLimit = await response.json().catch(() => ({}));
      const retryAfter = Math.ceil(Number(rateLimit.retry_after ?? 1) * 1000);
      await sleep(retryAfter);
      continue;
    }

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

  throw new Error(`Discord API rate limit did not clear for ${path}.`);
}

function verifyDiscordRequest(request, body, publicKey) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!signature || !timestamp) {
    return false;
  }

  return nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + body),
    hexToUint8Array(signature),
    hexToUint8Array(publicKey),
  );
}

function hexToUint8Array(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => Number.parseInt(byte, 16)));
}

function interactionMessage(content) {
  return interactionResponse({
    type: RESPONSE_TYPES.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: MESSAGE_FLAGS.EPHEMERAL,
    },
  });
}

function interactionResponse(body) {
  return jsonResponse(body);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
