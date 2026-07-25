const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const {
  buildGiveawayActiveEmbed,
  buildGiveawayEndedEmbed
} = require('../utils/embeds');

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'sorteos.json');

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ active: [], ended: [] }, null, 2));
  }
}

function readStore() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeStore(data) {
  ensureStorage();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function generateGiveawayId() {
  return crypto.randomBytes(4).toString('hex');
}

function createGiveaway(data) {
  const store = readStore();

  const giveaway = {
    id: generateGiveawayId(),
    guildId: data.guildId,
    channelId: data.channelId,
    messageId: null,
    hostId: data.hostId,
    prize: data.prize,
    winnersCount: data.winnersCount,
    endsAt: data.endsAt,
    ended: false,
    participants: [],
    winners: [],
    thumbnailUrl: data.thumbnailUrl || null,
    bannerUrl: data.bannerUrl || null,
    createdAt: Date.now()
  };

  store.active.push(giveaway);
  writeStore(store);
  return giveaway;
}

function setGiveawayMessageId(id, messageId) {
  const store = readStore();
  const giveaway = store.active.find(g => g.id === id);
  if (!giveaway) return null;
  giveaway.messageId = messageId;
  writeStore(store);
  return giveaway;
}

function getGiveawayById(id) {
  const store = readStore();
  return store.active.find(g => g.id === id) || store.ended.find(g => g.id === id) || null;
}

function getActiveGiveaways() {
  return readStore().active;
}

function getEntriesCount(giveawayId) {
  const giveaway = getGiveawayById(giveawayId);
  return giveaway ? giveaway.participants.length : 0;
}

function enterGiveaway(giveawayId, userId) {
  const store = readStore();
  const giveaway = store.active.find(g => g.id === giveawayId);

  if (!giveaway || giveaway.ended) {
    return { success: false, reason: 'not_found' };
  }

  if (giveaway.participants.includes(userId)) {
    return { success: false, reason: 'duplicate' };
  }

  giveaway.participants.push(userId);
  writeStore(store);
  return { success: true };
}

function pickWinners(participants, winnersCount) {
  const pool = [...participants];

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, winnersCount);
}

function buildParticipateRow(giveawayId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join:${giveawayId}`)
      .setLabel('🎉 Participar')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
}

async function refreshGiveawayMessage(client, giveawayId) {
  const giveaway = getGiveawayById(giveawayId);
  if (!giveaway || giveaway.ended || !giveaway.messageId) return;

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (!message) return;

  await message.edit({
    content: process.env.MENTION_EVERYONE === 'true'
      ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!'
      : '📢 ¡Atención, nuevo sorteo iniciado!',
    embeds: [buildGiveawayActiveEmbed(giveaway, giveaway.participants.length)],
    components: [buildParticipateRow(giveawayId, false)]
  }).catch(() => null);
}

async function endGiveaway(client, giveawayId) {
  const store = readStore();
  const index = store.active.findIndex(g => g.id === giveawayId);
  if (index === -1) return null;

  const giveaway = store.active[index];
  if (giveaway.ended) return null;

  const winners = pickWinners(giveaway.participants, giveaway.winnersCount);
  giveaway.winners = winners;
  giveaway.ended = true;
  store.active.splice(index, 1);
  store.ended.push(giveaway);
  writeStore(store);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel) return { giveaway, winners, winnersMentions: winners.map(id => `<@${id}>`).join(', ') || 'Sin participantes suficientes' };

  const message = giveaway.messageId
    ? await channel.messages.fetch(giveaway.messageId).catch(() => null)
    : null;

  const winnersMentions = winners.length
    ? winners.map(id => `<@${id}>`).join(', ')
    : 'Sin participantes suficientes';

  if (message) {
    await message.edit({
      content: process.env.MENTION_EVERYONE === 'true'
        ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!'
        : '📢 ¡Atención, nuevo sorteo iniciado!',
      embeds: [buildGiveawayEndedEmbed(giveaway, winnersMentions, `<@${giveaway.hostId}>`)],
      components: [buildParticipateRow(giveawayId, true)]
    }).catch(() => null);
  }

  await channel.send({
    content: winners.length
      ? `🎉 ¡Sorteo terminado! Enhorabuena ${winnersMentions}, habéis ganado **${giveaway.prize}**. Contactad con <@${giveaway.hostId}> para reclamar vuestro premio.`
      : `⚠️ El sorteo **${giveaway.prize}** terminó sin participantes válidos.`
  }).catch(() => null);

  return { giveaway, winners, winnersMentions };
}

async function rerollGiveaway(client, giveawayId) {
  const store = readStore();
  const giveaway = store.ended.find(g => g.id === giveawayId);
  if (!giveaway) return null;

  const winners = pickWinners(giveaway.participants, giveaway.winnersCount);
  giveaway.winners = winners;
  writeStore(store);

  const winnersMentions = winners.length
    ? winners.map(id => `<@${id}>`).join(', ')
    : 'Sin participantes suficientes';

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel) {
    await channel.send({
      content: winners.length
        ? `🔁 Reroll del sorteo **${giveaway.prize}**: nuevos ganadores ${winnersMentions}.`
        : `⚠️ No hay participantes suficientes para rehacer el sorteo **${giveaway.prize}**.`
    }).catch(() => null);
  }

  return { giveaway, winners, winnersMentions };
}

module.exports = {
  createGiveaway,
  setGiveawayMessageId,
  getGiveawayById,
  getActiveGiveaways,
  getEntriesCount,
  enterGiveaway,
  buildParticipateRow,
  refreshGiveawayMessage,
  endGiveaway,
  rerollGiveaway
};
