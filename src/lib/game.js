import { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } from "discord.js";
import { prisma } from "./prisma.js";

const rarityTable = [
  { rarity: "COMMON", weight: 60 },
  { rarity: "RARE", weight: 25 },
  { rarity: "EPIC", weight: 10 },
  { rarity: "LEGENDARY", weight: 4 },
  { rarity: "MYTHIC", weight: 1 }
];

const rarityEmoji = {
  COMMON: "⬜",
  RARE: "🟦",
  EPIC: "🟪",
  LEGENDARY: "🟨",
  MYTHIC: "🟥"
};

export function rollRarity() {
  const total = rarityTable.reduce((sum, r) => sum + r.weight, 0);
  let value = Math.random() * total;

  for (const entry of rarityTable) {
    if (value < entry.weight) return entry.rarity;
    value -= entry.weight;
  }

  return "COMMON";
}

export async function generateCopyByRarity(rarity) {
  const pool = await prisma.card.findMany({ where: { rarity } });
  if (pool.length === 0) {
    throw new Error(`No cards in rarity pool: ${rarity}`);
  }

  const selected = pool[Math.floor(Math.random() * pool.length)];
  const serialRanges = {
    MYTHIC: [1, 150],
    LEGENDARY: [151, 600],
    EPIC: [601, 1600],
    RARE: [1601, 4200],
    COMMON: [4201, 9999]
  };

  const [minSerial, maxSerial] = serialRanges[rarity] ?? serialRanges.COMMON;
  let serialNo = null;

  for (let i = 0; i < 25; i += 1) {
    const attempt = Math.floor(Math.random() * (maxSerial - minSerial + 1)) + minSerial;
    const exists = await prisma.cardCopy.findUnique({ where: { serialNo: attempt } });
    if (!exists) {
      serialNo = attempt;
      break;
    }
  }

  if (serialNo === null) {
    const globalMax = await prisma.cardCopy.aggregate({ _max: { serialNo: true } });
    serialNo = (globalMax._max.serialNo ?? 0) + 1;
  }

  return prisma.cardCopy.create({
    data: {
      serialNo,
      cardId: selected.id
    },
    include: { card: true }
  });
}

function dropLine(copy, index) {
  return `${index + 1}. ${rarityEmoji[copy.card.rarity]} **${copy.card.groupName} ${copy.card.idolName}** (${copy.card.era}) • \\#${copy.serialNo}`;
}

export function buildDropMessage(copies, authorId, expirySeconds) {
  return [
    `Meteor shower detected by <@${authorId}>.`,
    "",
    ...copies.map((copy, idx) => dropLine(copy, idx)),
    "",
    `Choose one unclaimed card below. Window closes in ${expirySeconds}s.`
  ].join("\n");
}

function buttonLabelForCopy(copy) {
  const base = `${copy.card.idolName} #${copy.serialNo}`;
  return base.length > 80 ? `${base.slice(0, 77)}...` : base;
}

export function buildDropButtons(dropId, copies) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`claim:${dropId}:1`).setLabel(buttonLabelForCopy(copies[0])).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`claim:${dropId}:2`).setLabel(buttonLabelForCopy(copies[1])).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`claim:${dropId}:3`).setLabel(buttonLabelForCopy(copies[2])).setStyle(ButtonStyle.Primary)
  );
}

export async function ensureUser(discordId) {
  return prisma.user.upsert({
    where: { discordId },
    create: { discordId },
    update: {}
  });
}

export function inventoryEmbed(targetUser, copies) {
  const lines = copies.slice(0, 20).map((copy) => {
    return `${rarityEmoji[copy.card.rarity]} **${copy.card.groupName} ${copy.card.idolName}** (${copy.card.era}) • \\#${copy.serialNo}`;
  });

  return new EmbedBuilder()
    .setTitle(`${targetUser.username}'s Collection`)
    .setDescription(lines.length ? lines.join("\n") : "No cards yet. Use /drop and claim one.")
    .setColor(0xff7aa2)
    .setFooter({ text: `Showing ${Math.min(copies.length, 20)} of ${copies.length} cards` });
}
