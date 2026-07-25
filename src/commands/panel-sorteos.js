const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const { buildPanelEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel-sorteos')
    .setDescription('Publica el panel maestro de sorteos')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_create_open')
        .setLabel('🎉 Crear Sorteo')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('giveaway_edit_open')
        .setLabel('🛠️ Editar Sorteo')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      embeds: [buildPanelEmbed()],
      components: [row]
    });
  }
};
