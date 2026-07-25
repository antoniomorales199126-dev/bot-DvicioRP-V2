require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');

const requiredEnv = ['DISCORD_TOKEN'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length) {
  console.error(`❌ Faltan variables de entorno obligatorias: ${missingEnv.join(', ')}`);
  console.error('Crea un archivo .env en la raíz del proyecto usando .env.example como plantilla.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.commands = new Collection();

function safeReadDir(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    console.error(`❌ No existe el directorio requerido: ${directoryPath}`);
    process.exit(1);
  }

  return fs.readdirSync(directoryPath).filter(file => file.endsWith('.js'));
}

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = safeReadDir(commandsPath);
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (!command?.data?.name || typeof command.execute !== 'function') {
    console.warn(`⚠️ Comando inválido omitido: ${file}`);
    continue;
  }
  client.commands.set(command.data.name, command);
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = safeReadDir(eventsPath);
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (!event?.name || typeof event.execute !== 'function') {
    console.warn(`⚠️ Evento inválido omitido: ${file}`);
    continue;
  }

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.on('error', error => {
  console.error('❌ Error del cliente de Discord:', error);
});

client.on('warn', warning => {
  console.warn('⚠️ Advertencia de Discord:', warning);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('❌ No se pudo iniciar sesión con el bot:', error);
  process.exit(1);
});
