const {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} = require('discord.js');
const {
  createGiveaway,
  setGiveawayMessageId,
  getGiveawayById,
  getEntriesCount,
  enterGiveaway,
  buildParticipateRow
} = require('../services/giveawayService');
const { buildGiveawayActiveEmbed } = require('../utils/embeds');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error('Error ejecutando comando:', error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ Ocurrió un error ejecutando el comando.', ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ content: '❌ Ocurrió un error ejecutando el comando.', ephemeral: true }).catch(() => null);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'giveaway_create_open') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({ content: '❌ No tienes permisos para crear sorteos.', ephemeral: true });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId('giveaway_create_modal')
          .setTitle('Configurar Sorteo Premium');

        const prizeInput = new TextInputBuilder()
          .setCustomId('prize')
          .setLabel('Premio del Sorteo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ej: Pase de Batalla VIP');

        const winnersInput = new TextInputBuilder()
          .setCustomId('winners')
          .setLabel('Cantidad de Ganadores')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('1');

        const durationInput = new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duración (en minutos)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('60');

        const thumbInput = new TextInputBuilder()
          .setCustomId('thumbnail')
          .setLabel('Foto Pequeña (Arriba Derecha)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('https://...');

        const bannerInput = new TextInputBuilder()
          .setCustomId('banner')
          .setLabel('Foto Grande (Banner Inferior)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('https://...');

        modal.addComponents(
          new ActionRowBuilder().addComponents(prizeInput),
          new ActionRowBuilder().addComponents(winnersInput),
          new ActionRowBuilder().addComponents(durationInput),
          new ActionRowBuilder().addComponents(thumbInput),
          new ActionRowBuilder().addComponents(bannerInput)
        );

        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === 'giveaway_edit_open') {
        await interaction.reply({ content: '🛠️ Próximamente: editor de sorteos activos.', ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('giveaway_join:')) {
        const giveawayId = interaction.customId.split(':')[1];
        const giveaway = getGiveawayById(giveawayId);
        if (!giveaway || giveaway.ended) {
          await interaction.reply({ content: '❌ Este sorteo ya no está disponible.', ephemeral: true });
          return;
        }

        const result = enterGiveaway(giveawayId, interaction.user.id);
        if (!result.success) {
          await interaction.reply({ content: '⚠️ Ya estás participando en este sorteo.', ephemeral: true });
          return;
        }

        const participantsCount = getEntriesCount(giveawayId);
        await interaction.message.edit({
          content: process.env.MENTION_EVERYONE === 'true' ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!' : '📢 ¡Atención, nuevo sorteo iniciado!',
          embeds: [buildGiveawayActiveEmbed(giveaway, participantsCount)],
          components: [buildParticipateRow(giveawayId, false)]
        });

        await interaction.reply({ content: '✅ Te has inscrito correctamente en el sorteo.', ephemeral: true });
      }

      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'giveaway_create_modal') {
      const prize = interaction.fields.getTextInputValue('prize').trim();
      const winnersCount = Number.parseInt(interaction.fields.getTextInputValue('winners'), 10);
      const durationMinutes = Number.parseInt(interaction.fields.getTextInputValue('duration'), 10);
      const thumbnail = interaction.fields.getTextInputValue('thumbnail').trim();
      const banner = interaction.fields.getTextInputValue('banner').trim();

      if (!prize) {
        await interaction.reply({ content: '❌ El premio no puede estar vacío.', ephemeral: true });
        return;
      }
      if (!Number.isInteger(winnersCount) || winnersCount < 1) {
        await interaction.reply({ content: '❌ La cantidad de ganadores debe ser un número mayor que 0.', ephemeral: true });
        return;
      }
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
        await interaction.reply({ content: '❌ La duración debe ser un número mayor que 0.', ephemeral: true });
        return;
      }

      const giveaway = createGiveaway({
        guildId: interaction.guild.id,
        channelId: process.env.GIVEAWAY_CHANNEL_ID || interaction.channel.id,
        hostId: interaction.user.id,
        prize,
        winnersCount,
        endsAt: Date.now() + durationMinutes * 60 * 1000,
        thumbnailUrl: thumbnail || null,
        bannerUrl: banner || null
      });

      const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
      if (!channel) {
        await interaction.reply({ content: '❌ No pude encontrar el canal de sorteos configurado.', ephemeral: true });
        return;
      }

      const message = await channel.send({
        content: process.env.MENTION_EVERYONE === 'true' ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!' : '📢 ¡Atención, nuevo sorteo iniciado!',
        embeds: [buildGiveawayActiveEmbed(giveaway, 0)],
        components: [buildParticipateRow(giveaway.id, false)]
      });

      setGiveawayMessageId(giveaway.id, message.id);

      await interaction.reply({
        content: `✅ Sorteo creado correctamente. ID: \`${giveaway.id}\``,
        ephemeral: true
      });
    }
  }
};
