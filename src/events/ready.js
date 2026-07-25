const { Events } = require('discord.js');
const { startScheduler } = require('../services/scheduler');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    startScheduler(client);
  }
};
