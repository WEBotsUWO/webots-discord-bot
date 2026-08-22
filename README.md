# Webots Discord Bot

A Cloudflare Workers onboarding bot for a university humanoid robotics club Discord server.

This bot does not create the server layout. It only handles onboarding from a welcome button:

1. Ask for a real/preferred name.
2. Try to set the member's server nickname.
3. Ask them to choose one main team.
4. Give them `Member` plus exactly one team role.
5. Remove the other team roles so the team choice stays mutually exclusive.

## Roles You Create Manually

Create these roles in Discord:

- `Member`
- `Mechanical`
- `Electrical`
- `Software`
- `Comp`
- `Business`

Move the bot role above all six roles.

## Server Permissions You Set Manually

Create your welcome channel and server layout however you want.

Recommended onboarding visibility:

- Let `@everyone` view only your welcome channel.
- Hide the rest of the server from `@everyone`.
- Allow `Member` to view the rest of the server.

## Important Security Note

Keep real secrets only in `.env` locally and Cloudflare Worker secrets in production. If a real bot token was ever saved in `.env.example`, reset the token in the Discord Developer Portal before deploying.

## Install Dependencies

Install Node.js LTS from [nodejs.org](https://nodejs.org/), then run:

```bash
npm install
```

## Local `.env`

Create `.env` in the project root:

```env
DISCORD_TOKEN=
PUBLIC_KEY=
CLIENT_ID=
GUILD_ID=
WELCOME_CHANNEL_ID=
NEW_MEMBER_WELCOME_CHANNEL_ID=
CODE_OF_CONDUCT_CHANNEL_ID=
QUESTIONS_CHANNEL_ID=
MISSION_STATEMENT_CHANNEL_ID=
ORG_STRUCTURE_CHANNEL_ID=
SETH_USER_ID=
ALEKS_USER_ID=
JAYLEN_USER_ID=
```

Where:

- `DISCORD_TOKEN` is your bot token.
- `PUBLIC_KEY` is from Discord Developer Portal > General Information > Public Key.
- `CLIENT_ID` is your application ID.
- `GUILD_ID` is your Discord server ID. It is only used to clear old guild slash commands.
- `WELCOME_CHANNEL_ID` is the channel where the onboarding button should be posted.
- `NEW_MEMBER_WELCOME_CHANNEL_ID` is the separate channel where the public welcome message should be posted after onboarding completes.
- `CODE_OF_CONDUCT_CHANNEL_ID`, `QUESTIONS_CHANNEL_ID`, and `MISSION_STATEMENT_CHANNEL_ID` make the welcome message channel references clickable.
- `ORG_STRUCTURE_CHANNEL_ID` is the channel where `npm run post:org` posts the organization structure.
- `SETH_USER_ID`, `ALEKS_USER_ID`, and `JAYLEN_USER_ID` make the staff names clickable mentions.

## Invite the Bot

In Discord Developer Portal > OAuth2 > URL Generator, select:

- `bot`
- `applications.commands`

Bot permissions:

- Manage Roles
- Manage Nicknames
- Send Messages
- View Channels
- Embed Links
- Read Message History

`applications.commands` is only needed if you want to clear old slash commands using this project. The onboarding flow itself uses buttons, modals, and dropdowns.

## Set Cloudflare Secrets

Log in to Cloudflare:

```bash
npx wrangler login
```

Then add secrets:

```bash
npx wrangler secret put DISCORD_TOKEN
npx wrangler secret put PUBLIC_KEY
npx wrangler secret put CLIENT_ID
npx wrangler secret put NEW_MEMBER_WELCOME_CHANNEL_ID
npx wrangler secret put CODE_OF_CONDUCT_CHANNEL_ID
npx wrangler secret put QUESTIONS_CHANNEL_ID
npx wrangler secret put MISSION_STATEMENT_CHANNEL_ID
npx wrangler secret put SETH_USER_ID
npx wrangler secret put ALEKS_USER_ID
npx wrangler secret put JAYLEN_USER_ID
```

Paste the matching value when Wrangler prompts you.

The first three Worker secrets are required for onboarding. The welcome-message channel/user ID secrets are required if you want the public welcome message to be posted with clickable mentions.

## Deploy the Worker

```bash
npm run deploy
```

Copy the deployed Worker URL. It will look like:

```text
https://webots-discord-bot.<your-subdomain>.workers.dev
```

## Set Discord Interactions Endpoint

In Discord Developer Portal:

1. Open your application.
2. Go to General Information.
3. Paste the Worker URL into Interactions Endpoint URL.
4. Click Save Changes.

Discord will send a PING request. The Worker verifies Discord's signature and responds automatically.

## Remove Old Slash Commands

Because `/setup-server` is no longer used, clear old guild commands:

```bash
npm run clear:commands
```

## Post the Welcome Button

After setting `WELCOME_CHANNEL_ID` in `.env`, run:

```bash
npm run post:welcome
```

This posts or updates the onboarding embed with the **Start Onboarding** button.

## Post the Org Structure

After setting `ORG_STRUCTURE_CHANNEL_ID` in `.env`, run:

```bash
npm run post:org
```

This posts the contents of `content/org-structure.md` and attaches the chart from `assets/org-structure.svg`. Re-running the command replaces the previous bot-authored org-structure post instead of creating a duplicate.

## Test Onboarding

1. Confirm the Worker URL is saved as the Discord Interactions Endpoint URL.
2. Confirm the six roles exist.
3. Confirm the bot role is above those roles.
4. Run `npm run post:welcome`.
5. Click **Start Onboarding** in the welcome channel.
6. Enter a real or preferred name.
7. Choose one team:
   - Mechanical
   - Electrical
   - Software
   - Comp
   - Business
8. Confirm the user receives `Member` plus exactly one team role.
9. Confirm a public welcome message appears in `NEW_MEMBER_WELCOME_CHANNEL_ID`.

## Public Welcome Message

When onboarding completes, the Worker posts this message in `NEW_MEMBER_WELCOME_CHANNEL_ID`:

```text
Welcome to WeBots, @user! We meet every week on Thursday at 7:00pm in Aceb-3435. You can join anytime!

In the meantime, to get started:
- read the code-of-conduct
- ask questions in questions-answers
- learn about our mission under mission-statement

If you need anything else, reach out to @seth, @aleks, or @jaylen.
Excited to have you on board!
```

The member, channel, and staff names become real Discord mentions when the matching IDs are configured.

Note: this Cloudflare Interactions Worker does not receive Discord's true member-join Gateway event. It posts the welcome message after the member completes onboarding. A literal message the instant someone joins requires a separate Gateway bot process with the Guild Members intent.

## Troubleshooting

- If Discord refuses the Interactions Endpoint URL, check that `PUBLIC_KEY` is set as a Cloudflare secret.
- If the button does nothing, make sure the Interactions Endpoint URL points at the deployed Worker.
- If the bot says roles are missing, create the missing roles manually.
- If role assignment fails, move the bot role above `Member` and all team roles.
- If nickname changes fail, check Manage Nicknames and role hierarchy.
- Use Cloudflare Dashboard > Workers & Pages > Logs to inspect Worker errors.
