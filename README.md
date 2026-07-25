# bot-DvicioRP-V2

Bot de sorteos para Discord con panel visual, modales y persistencia en JSON.

## Configuración

1. Copia `.env.example` a `.env`
2. Rellena como mínimo `DISCORD_TOKEN`
3. Verifica que el bot esté invitado al servidor correcto

```bash
npm install
npm run deploy
npm start
```

## Variables de entorno

- `DISCORD_TOKEN`: token real del bot
- `DISCORD_CLIENT_ID`: `1529841387149852862`
- `DISCORD_GUILD_ID`: `1483885718446280706`
- `GIVEAWAY_CHANNEL_ID`: `1529641733774905535`
- `MENTION_EVERYONE`: `true` o `false`

## Comandos

- `/panel-sorteos` publica el panel maestro visual.
- `/sorteo ver` muestra los sorteos activos.
- `/sorteo finalizar id:<id>` finaliza un sorteo.
- `/sorteo reroll id:<id>` rehace el sorteo para elegir nuevos ganadores.

## Problemas comunes

- Si `npm run deploy` falla, revisa que `.env` exista y tenga token, client ID y guild ID.
- Si el bot no publica el sorteo, revisa permisos en el canal configurado.
- Si el bot no inicia, revisa que el token sea válido y que `npm install` se haya ejecutado.
