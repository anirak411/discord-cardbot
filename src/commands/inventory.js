import { SlashCommandBuilder } from "discord.js";
import { prisma } from "../lib/prisma.js";
import { ensureUser, inventoryEmbed } from "../lib/game.js";

export const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("View your card collection.")
  .addUserOption((opt) => opt.setName("user").setDescription("Check another user's collection"));

export async function execute(interaction) {
  const target = interaction.options.getUser("user") ?? interaction.user;
  await ensureUser(target.id);

  const copies = await prisma.cardCopy.findMany({
    where: { owner: { discordId: target.id } },
    include: { card: true },
    orderBy: { serialNo: "desc" }
  });

  await interaction.reply({ embeds: [inventoryEmbed(target, copies)], ephemeral: true });
}
