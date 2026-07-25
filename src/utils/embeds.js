const { EmbedBuilder } = require('discord.js');
const { formatRemaining } = require('./time');

function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle('🪻 PANEL DE CONTROL MAESTRO 🪻')
    .setDescription('Gestión global de anuncios masivos y sorteos.');
}

function buildGiveawayActiveEmbed(giveaway, participantsCount) {
  const remaining = giveaway.endsAt - Date.now();

  const embed = new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle('🪻 GRAN SORTEO ACTIVO 🪻')
    .setDescription([
      `**Premio:** \`${giveaway.prize}\``,
      '',
      'Presiona el botón inferior para inscribirte.'
    ].join('\n'))
    .addFields(
      {
        name: '⏳ Finaliza en',
        value: formatRemaining(remaining),
        inline: true
      },
      {
        name: '🏆 Ganadores',
        value: String(giveaway.winnersCount),
        inline: true
      },
      {
        name: '👥 Participantes',
        value: `${participantsCount} usuarios`,
        inline: true
      }
    )
    .setFooter({ text: `ID Sorteo: ${giveaway.id}` })
    .setTimestamp();

  if (giveaway.thumbnailUrl) {
    embed.setThumbnail(giveaway.thumbnailUrl);
  }

  if (giveaway.bannerUrl) {
    embed.setImage(giveaway.bannerUrl);
  }

  return embed;
}

function buildGiveawayEndedEmbed(giveaway, winnersMentions, hostMention) {
  const embed = new EmbedBuilder()
    .setColor('#9b59b6')
    .setTitle('🪻 SORTEO FINALIZADO 🪻')
    .addFields(
      {
        name: 'Premio',
        value: `\`${giveaway.prize}\``,
        inline: false
      },
      {
        name: 'Ganadores',
        value: winnersMentions || 'Sin ganadores válidos',
        inline: false
      },
      {
        name: 'Organizado por',
        value: hostMention,
        inline: false
      }
    )
    .setFooter({ text: `ID Sorteo: ${giveaway.id} • Finalizado` })
    .setTimestamp();

  if (giveaway.thumbnailUrl) {
    embed.setThumbnail(giveaway.thumbnailUrl);
  }

  return embed;
}

module.exports = {
  buildPanelEmbed,
  buildGiveawayActiveEmbed,
  buildGiveawayEndedEmbed
};
