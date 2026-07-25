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
      subcommand.setName('ver').setDescription('Ver sorteos activos')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('finalizar')
        .setDescription('Finaliza un sorteo manualmente')
        .addStringOption(option =>
          option.setName('id').setDescription('ID del sorteo').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('reroll')
        .setDescription('Elige nuevos ganadores para un sorteo finalizado')
        .addStringOption(option =>
          option.setName('id').setDescription('ID del sorteo').setRequired(true)
        )
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'ver') {
      const active = getActiveGiveaways();
      if (!active.length) {
        await interaction.reply({ content: 'No hay sorteos activos.', flags: 64 });
        return;
      }

      const lines = active.map(g => (
        `• ID: \`${g.id}\` — Premio: **${g.prize}** — Ganadores: **${g.winnersCount}** — Participantes: **${g.participants.length}**`
      ));
      await interaction.reply({ content: lines.join('\n'), flags: 64 });
      return;
    }

    if (subcommand === 'finalizar') {
      const id = interaction.options.getString('id', true);
      const giveaway = getGiveawayById(id);
      if (!giveaway) {
        await interaction.reply({ content: 'No existe un sorteo con ese ID.', flags: 64 });
        return;
      }
      if (giveaway.ended) {
        await interaction.reply({ content: 'Ese sorteo ya está finalizado.', flags: 64 });
        return;
      }

      const result = await endGiveaway(client, id);
      if (!result) {
        await interaction.reply({ content: '❌ No se pudo finalizar el sorteo.', flags: 64 });
        return;
      }

      await interaction.reply({ content: `✅ Sorteo \`${id}\` finalizado.`, flags: 64 });
      return;
    }

    if (subcommand === 'reroll') {
      const id = interaction.options.getString('id', true);
      const giveaway = getGiveawayById(id);
      if (!giveaway) {
        await interaction.reply({ content: 'No existe un sorteo con ese ID.', flags: 64 });
        return;
      }
      if (!giveaway.ended) {
        await interaction.reply({ content: 'Solo puedes hacer reroll de sorteos finalizados.', flags: 64 });
        return;
      }
      if (!giveaway.participants.length) {
        await interaction.reply({ content: 'Ese sorteo no tiene participantes para rehacer.', flags: 64 });
        return;
      }

      const result = await rerollGiveaway(client, id);
      await interaction.reply({
        content: result ? `🔁 Nuevos ganadores para \`${id}\`: ${result.winnersMentions}` : 'No se pudo rehacer el sorteo.',
        flags: 64
      });
    }
  }
};
