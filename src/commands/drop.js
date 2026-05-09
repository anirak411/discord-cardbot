import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { prisma } from "../lib/prisma.js";
import { rollRarity, generateCopyByRarity, buildDropMessage, buildDropButtons, ensureUser, renderDropStrip } from "../lib/game.js";

const dropCooldownSeconds = Number(process.env.DROP_COOLDOWN_SECONDS ?? 45);
const dropExpirySeconds = Number(process.env.DROP_EXPIRY_SECONDS ?? 60);

export const data = new SlashCommandBuilder()
  .setName("drop")
  .setDescription("Drop 3 random K-pop cards for claiming.");

export async function execute(interaction) {
  const discordId = interaction.user.id;
  const now = new Date();
  const user = await ensureUser(discordId);

  if (user.lastDropAt) {
    const next = new Date(user.lastDropAt.getTime() + dropCooldownSeconds * 1000);
    if (now < next) {
      const wait = Math.ceil((next.getTime() - now.getTime()) / 1000);
      await interaction.reply({ content: `Drop cooldown active. Try again in ${wait}s.`, ephemeral: true });
      return;
    }
  }

  await interaction.deferReply();

  const copies = [];
  for (let i = 0; i < 3; i += 1) {
    const rarity = rollRarity();
    const copy = await generateCopyByRarity(rarity);
    copies.push(copy);
  }

  const drop = await prisma.drop.create({
    data: {
      channelId: interaction.channelId,
      slot1CopyId: copies[0].id,
      slot2CopyId: copies[1].id,
      slot3CopyId: copies[2].id,
      expiresAt: new Date(Date.now() + dropExpirySeconds * 1000)
    }
  });

  const dropImage = await renderDropStrip(copies);
  const attachment = new AttachmentBuilder(dropImage, { name: "drop-strip.jpg" });

  const message = await interaction.editReply({
    content: buildDropMessage(copies, interaction.user.id, dropExpirySeconds),
    components: [buildDropButtons(drop.id, copies)],
    files: [attachment]
  });

  await prisma.drop.update({ where: { id: drop.id }, data: { messageId: message.id } });
  await prisma.user.update({ where: { discordId }, data: { lastDropAt: now } });
}
