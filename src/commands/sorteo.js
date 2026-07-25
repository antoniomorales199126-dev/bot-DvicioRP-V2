const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
  getActiveGiveaways,
  endGiveaway,
  rerollGiveaway,
  getGiveawayById
} = require('../services/giveawayService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sorteo')
    .setDescription('Gestión administrativa de sorteos')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('ver')
        .setDescription('Ver sorteos activos')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('finalizar')
        .setDescription('Finaliza un sorteo manualmente')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Elige nuevos ganadores para un sorteo finalizado')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('ID del sorteo')
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'ver') {
      const active = getActiveGiveaways();

      if (!active.length) {
        await interaction.reply({ content: 'No hay sorteos activos.', ephemeral: true });
        return;
      }

      const lines = active.map(g => `• ID: \`${g.id}\` — Premio: **${g.prize}** — Ganadores: **${g.winnersCount}**`);
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
      return;
    }

    if (subcommand === 'finalizar') {
      const id = interaction.options.getString('id', true);
      const giveaway = getGiveawayById(id);

      if (!giveaway) {
        await interaction.reply({ content: 'No existe un sorteo con ese ID.', ephemeral: true });
        return;
      }

      if (giveaway.ended) {
        await interaction.reply({ content: 'Ese sorteo ya está finalizado.', ephemeral: true });
        return;
      }

      await endGiveaway(client, id);
      await interaction.reply({ content: `✅ Sorteo \`${id}\` finalizado.`, ephemeral: true });
      return;
    }

    if (subcommand === 'reroll') {
      const id = interaction.options.getString('id', true);
      const giveaway = getGiveawayById(id);

      if (!giveaway) {
        await interaction.reply({ content: 'No existe un sorteo con ese ID.', ephemeral: true });
        return;
      }

      if (!giveaway.ended) {
        await interaction.reply({ content: 'Solo puedes hacer reroll de sorteos finalizados.', ephemeral: true });
        return;
      }

      const result = await rerollGiveaway(client, id);
      await interaction.reply({
        content: result
          ? `🔁 Nuevos ganadores para \`${id}\`: ${result.winnersMentions}`
          : 'No se pudo rehacer el sorteo.',
        ephemeral: true
      });
    }
  }
};
