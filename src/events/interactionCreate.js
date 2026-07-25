const {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const {
  createGiveaway,
  removeGiveaway,
  setGiveawayMessageId,
  getGiveawayById,
  getEntriesCount,
  enterGiveaway,
  buildParticipateRow,
  isValidImageUrl
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
          await interaction.followUp({ content: '❌ Ocurrió un error ejecutando el comando.', flags: 64 }).catch(() => null);
        } else {
          await interaction.reply({ content: '❌ Ocurrió un error ejecutando el comando.', flags: 64 }).catch(() => null);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'giveaway_create_open') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({ content: '❌ No tienes permisos para crear sorteos.', flags: 64 });
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
          .setMaxLength(100)
          .setPlaceholder('Ej: Pase de Batalla VIP');

        const winnersInput = new TextInputBuilder()
          .setCustomId('winners')
          .setLabel('Cantidad de Ganadores')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3)
          .setPlaceholder('1');

        const durationInput = new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('Duración (en minutos)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(6)
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
        await interaction.reply({ content: '🛠️ Próximamente: editor de sorteos activos.', flags: 64 });
        return;
      }

      if (interaction.customId.startsWith('giveaway_join:')) {
        const giveawayId = interaction.customId.split(':')[1];
        const giveaway = getGiveawayById(giveawayId);
        if (!giveaway || giveaway.ended) {
          await interaction.reply({ content: '❌ Este sorteo ya no está disponible.', flags: 64 });
          return;
        }

        const result = enterGiveaway(giveawayId, interaction.user.id);
        if (!result.success) {
          const content = result.reason === 'duplicate'
            ? '⚠️ Ya estás participando en este sorteo.'
            : '❌ No se pudo registrar tu participación.';
          await interaction.reply({ content, flags: 64 });
          return;
        }

        const updatedGiveaway = getGiveawayById(giveawayId);
        const participantsCount = getEntriesCount(giveawayId);
        await interaction.message.edit({
          content: process.env.MENTION_EVERYONE === 'true' ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!' : '📢 ¡Atención, nuevo sorteo iniciado!',
          embeds: [buildGiveawayActiveEmbed(updatedGiveaway, participantsCount)],
          components: [buildParticipateRow(giveawayId, false)]
        }).catch(error => {
          console.error('No se pudo actualizar el mensaje del sorteo:', error);
        });

        await interaction.reply({ content: '✅ Te has inscrito correctamente en el sorteo.', flags: 64 });
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
        await interaction.reply({ content: '❌ El premio no puede estar vacío.', flags: 64 });
        return;
      }
      if (!Number.isInteger(winnersCount) || winnersCount < 1 || winnersCount > 50) {
        await interaction.reply({ content: '❌ La cantidad de ganadores debe ser un número entre 1 y 50.', flags: 64 });
        return;
      }
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080) {
        await interaction.reply({ content: '❌ La duración debe ser un número entre 1 y 10080 minutos.', flags: 64 });
        return;
      }
      if (thumbnail && !isValidImageUrl(thumbnail)) {
        await interaction.reply({ content: '❌ La miniatura debe ser una URL válida de imagen.', flags: 64 });
        return;
      }
      if (banner && !isValidImageUrl(banner)) {
        await interaction.reply({ content: '❌ El banner debe ser una URL válida de imagen.', flags: 64 });
        return;
      }

      const configuredChannelId = process.env.GIVEAWAY_CHANNEL_ID || interaction.channelId;
      const channel = await interaction.client.channels.fetch(configuredChannelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: '❌ No pude encontrar un canal de texto válido para publicar el sorteo.', flags: 64 });
        return;
      }

      const giveaway = createGiveaway({
        guildId: interaction.guild.id,
        channelId: configuredChannelId,
        hostId: interaction.user.id,
        prize,
        winnersCount,
        endsAt: Date.now() + durationMinutes * 60 * 1000,
        thumbnailUrl: thumbnail || null,
        bannerUrl: banner || null
      });

      try {
        const message = await channel.send({
          content: process.env.MENTION_EVERYONE === 'true' ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!' : '📢 ¡Atención, nuevo sorteo iniciado!',
          embeds: [buildGiveawayActiveEmbed(giveaway, 0)],
          components: [buildParticipateRow(giveaway.id, false)]
        });

        setGiveawayMessageId(giveaway.id, message.id);
      } catch (error) {
        console.error('No se pudo publicar el sorteo:', error);
        removeGiveaway(giveaway.id);
        await interaction.reply({ content: '❌ No pude publicar el sorteo en el canal configurado. Revisa permisos del bot.', flags: 64 });
        return;
      }

      await interaction.reply({
        content: `✅ Sorteo creado correctamente. ID: \`${giveaway.id}\``,
        flags: 64
      });
    }
  }
};
