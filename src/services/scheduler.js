const { getActiveGiveaways, refreshGiveawayMessage, endGiveaway } = require('./giveawayService');

function startScheduler(client) {
  setInterval(async () => {
    const giveaways = getActiveGiveaways();
    for (const giveaway of giveaways) {
      if (Date.now() >= giveaway.endsAt) {
        await endGiveaway(client, giveaway.id);
      } else {
        await refreshGiveawayMessage(client, giveaway.id);
      }
    }
  }, 15000);
}

module.exports = { startScheduler };
