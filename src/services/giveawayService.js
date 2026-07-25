const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildGiveawayActiveEmbed, buildGiveawayEndedEmbed } = require('../utils/embeds');

const dataDir = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'sorteos.json');

function ensureStorage() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ active: [], ended: [] }, null, 2));
}

function normalizeStore(store) {
  return {
    active: Array.isArray(store?.active) ? store.active : [],
    ended: Array.isArray(store?.ended) ? store.ended : []
  };
}

function readStore() {
  ensureStorage();

  try {
    return normalizeStore(JSON.parse(fs.readFileSync(dataFile, 'utf8')));
  } catch (error) {
    console.error('❌ El archivo sorteos.json estaba dañado. Se ha restaurado automáticamente.', error);
    const fallback = { active: [], ended: [] };
    writeStore(fallback);
    return fallback;
  }
}

function writeStore(data) {
  ensureStorage();
  fs.writeFileSync(dataFile, JSON.stringify(normalizeStore(data), null, 2));
}

function generateGiveawayId() {
  return crypto.randomBytes(4).toString('hex');
}

function isValidImageUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && /\.(png|jpe?g|gif|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
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

function removeGiveaway(id) {
  const store = readStore();
  const initialLength = store.active.length;
  store.active = store.active.filter(g => g.id !== id);
  writeStore(store);
  return store.active.length !== initialLength;
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
  if (!giveaway || giveaway.ended) return { success: false, reason: 'not_found' };
  if (giveaway.participants.includes(userId)) return { success: false, reason: 'duplicate' };

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

async function fetchGiveawayMessage(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel || typeof channel.messages?.fetch !== 'function') return { channel: null, message: null };

  const message = giveaway.messageId
    ? await channel.messages.fetch(giveaway.messageId).catch(() => null)
    : null;

  return { channel, message };
}

async function refreshGiveawayMessage(client, giveawayId) {
  const giveaway = getGiveawayById(giveawayId);
  if (!giveaway || giveaway.ended || !giveaway.messageId) return;

  const { message } = await fetchGiveawayMessage(client, giveaway);
  if (!message) return;

  await message.edit({
    content: process.env.MENTION_EVERYONE === 'true' ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!' : '📢 ¡Atención, nuevo sorteo iniciado!',
    embeds: [buildGiveawayActiveEmbed(giveaway, giveaway.participants.length)],
    components: [buildParticipateRow(giveawayId, false)]
  }).catch(error => {
    console.error('No se pudo refrescar el mensaje del sorteo:', error);
  });
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

  const winnersMentions = winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Sin participantes suficientes';
  const { channel, message } = await fetchGiveawayMessage(client, giveaway);

  if (message) {
    await message.edit({
      content: process.env.MENTION_EVERYONE === 'true' ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!' : '📢 ¡Atención, nuevo sorteo iniciado!',
      embeds: [buildGiveawayEndedEmbed(giveaway, winnersMentions, `<@${giveaway.hostId}>`, giveaway.participants.length)],
      components: [buildParticipateRow(giveawayId, true)]
    }).catch(error => {
      console.error('No se pudo actualizar el mensaje final del sorteo:', error);
    });
  }

  if (channel) {
    await channel.send({
      content: winners.length
        ? `🎉 ¡Sorteo terminado! Enhorabuena ${winnersMentions}, habéis ganado **${giveaway.prize}**. Contactad con <@${giveaway.hostId}> para reclamar vuestro premio.`
        : `⚠️ El sorteo **${giveaway.prize}** terminó sin participantes válidos.`
    }).catch(error => {
      console.error('No se pudo enviar el mensaje de cierre del sorteo:', error);
    });
  }

  return { giveaway, winners, winnersMentions };
}

async function rerollGiveaway(client, giveawayId) {
  const store = readStore();
  const giveaway = store.ended.find(g => g.id === giveawayId);
  if (!giveaway) return null;

  const winners = pickWinners(giveaway.participants, giveaway.winnersCount);
  giveaway.winners = winners;
  writeStore(store);

  const winnersMentions = winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Sin participantes suficientes';
  const { channel, message } = await fetchGiveawayMessage(client, giveaway);

  if (message) {
    await message.edit({
      content: process.env.MENTION_EVERYONE === 'true' ? '@everyone 📢 ¡Atención, nuevo sorteo iniciado!' : '📢 ¡Atención, nuevo sorteo iniciado!',
      embeds: [buildGiveawayEndedEmbed(giveaway, winnersMentions, `<@${giveaway.hostId}>`, giveaway.participants.length)],
      components: [buildParticipateRow(giveawayId, true)]
    }).catch(error => {
      console.error('No se pudo actualizar el mensaje tras el reroll:', error);
    });
  }

  if (channel) {
    await channel.send({
      content: winners.length
        ? `🔁 Reroll del sorteo **${giveaway.prize}**: nuevos ganadores ${winnersMentions}.`
        : `⚠️ No hay participantes suficientes para rehacer el sorteo **${giveaway.prize}**.`
    }).catch(error => {
      console.error('No se pudo anunciar el reroll:', error);
    });
  }

  return { giveaway, winners, winnersMentions };
}

module.exports = {
  createGiveaway,
  removeGiveaway,
  setGiveawayMessageId,
  getGiveawayById,
  getActiveGiveaways,
  getEntriesCount,
  enterGiveaway,
  buildParticipateRow,
  refreshGiveawayMessage,
  endGiveaway,
  rerollGiveaway,
  isValidImageUrl
};
