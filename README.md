# bot-DvicioRP-V2

Bot de sorteos para Discord con panel visual, modales y persistencia en JSON.

## Configuración

Copia `.env.example` a `.env` y rellena los valores:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `GIVEAWAY_CHANNEL_ID`

## Instalación

```bash
npm install
npm run deploy
npm start
```

## Comandos

- `/panel-sorteos` publica el panel maestro visual.
- `/sorteo ver` muestra los IDs de sorteos activos.
- `/sorteo finalizar id:<id>` finaliza un sorteo.
- `/sorteo reroll id:<id>` rehace el sorteo para elegir nuevos ganadores.

## Flujo

1. Ejecuta `/panel-sorteos`.
2. Pulsa **Crear Sorteo**.
3. Completa el modal con premio, ganadores, duración e imágenes.
4. Los usuarios participan con el botón **Participar**.
5. El bot actualiza participantes y finaliza automáticamente.
