import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Events,
  ActionRowBuilder,
  ButtonBuilder
} from "discord.js";
import { prisma } from "./lib/prisma.js";
import * as drop from "./commands/drop.js";
import * as inventory from "./commands/inventory.js";
import * as ping from "./commands/ping.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const claimCooldownSeconds = Number(process.env.CLAIM_COOLDOWN_SECONDS ?? 45);

if (!token || !clientId || !guildId) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env");
  process.exit(1);
}

const commandModules = [drop, inventory, ping];
const commands = new Collection();

for (const mod of commandModules) {
  commands.set(mod.data.name, mod);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandModules.map((m) => m.data.toJSON())
  });
  console.log("Registered slash commands.");
}

function parseClaimId(customId) {
  const [action, dropIdStr, slotStr] = customId.split(":");
  if (action !== "claim") return null;

  const dropId = Number(dropIdStr);
  const slot = Number(slotStr);
  if (!Number.isInteger(dropId) || ![1, 2, 3].includes(slot)) return null;

  return { dropId, slot };
}

function claimUpdateField(slot) {
  if (slot === 1) return "claimed1By";
  if (slot === 2) return "claimed2By";
  return "claimed3By";
}

function slotCopyField(slot) {
  if (slot === 1) return "slot1CopyId";
  if (slot === 2) return "slot2CopyId";
  return "slot3CopyId";
}

function getClaimedUserIdForSlot(dropRecord, slot) {
  if (slot === 1) return dropRecord.claimed1By;
  if (slot === 2) return dropRecord.claimed2By;
  return dropRecord.claimed3By;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction);
      return;
    }

    if (!interaction.isButton()) return;
    const parsed = parseClaimId(interaction.customId);
    if (!parsed) return;

    const { dropId, slot } = parsed;

    const result = await prisma.$transaction(async (tx) => {
      const dropRecord = await tx.drop.findUnique({ where: { id: dropId } });
      if (!dropRecord) return { ok: false, msg: "Drop not found." };

      if (new Date() > dropRecord.expiresAt) {
        return { ok: false, msg: "Drop expired." };
      }

      if (
        dropRecord.claimed1By === interaction.user.id ||
        dropRecord.claimed2By === interaction.user.id ||
        dropRecord.claimed3By === interaction.user.id
      ) {
        return { ok: false, msg: "You already claimed a card from this drop." };
      }

      const claimField = claimUpdateField(slot);
      if (dropRecord[claimField]) {
        return { ok: false, msg: "That slot is already claimed." };
      }

      const copyField = slotCopyField(slot);
      const copyId = dropRecord[copyField];

      const user = await tx.user.upsert({
        where: { discordId: interaction.user.id },
        create: { discordId: interaction.user.id },
        update: {}
      });

      const now = new Date();
      const isOwnDrop = dropRecord.createdBy === interaction.user.id;
      if (!isOwnDrop && user.lastClaimAt) {
        const next = new Date(user.lastClaimAt.getTime() + claimCooldownSeconds * 1000);
        if (now < next) {
          const wait = Math.ceil((next.getTime() - now.getTime()) / 1000);
          return { ok: false, msg: `Claim cooldown active. Try again in ${wait}s.` };
        }
      }

      const updatedDrop = await tx.drop.update({
        where: { id: dropId },
        data: { [claimField]: interaction.user.id }
      });

      await tx.cardCopy.update({
        where: { id: copyId },
        data: { ownerId: user.id, obtainedAt: new Date() },
        include: { card: true }
      });

      await tx.user.update({
        where: { id: user.id },
        data: { lastClaimAt: now }
      });

      const claimed = await tx.cardCopy.findUnique({
        where: { id: copyId },
        include: { card: true }
      });

      return { ok: true, claimed, updatedDrop };
    });

    if (!result.ok) {
      await interaction.reply({ content: result.msg });
      return;
    }

    const updatedRows = interaction.message.components.map((row) => {
      const newRow = new ActionRowBuilder();
      for (const component of row.components) {
        const button = ButtonBuilder.from(component);
        if (component.customId === interaction.customId) {
          button.setDisabled(true);
        }
        newRow.addComponents(button);
      }
      return newRow;
    });

    const claimSummary = [1, 2, 3]
      .map((s) => {
        const userId = getClaimedUserIdForSlot(result.updatedDrop, s);
        return userId ? `${s}: <@${userId}>` : `${s}: unclaimed`;
      })
      .join(" | ");

    await interaction.update({
      content: `${interaction.message.content.split("\nClaims:")[0]}\nClaims: ${claimSummary}`,
      components: updatedRows
    });

    await interaction.channel.send({
      content: `<@${interaction.user.id}> claimed **#${result.claimed.serialNo} ${result.claimed.card.idolName}** (${result.claimed.card.groupName} - ${result.claimed.card.era})`
    });
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: "Something went wrong." });
    } else {
      await interaction.reply({ content: "Something went wrong." });
    }
  }
});

client.login(token);
