import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check if bot is alive.");

export async function execute(interaction) {
  await interaction.reply({ content: "Pong. CardBot is online.", ephemeral: true });
}
