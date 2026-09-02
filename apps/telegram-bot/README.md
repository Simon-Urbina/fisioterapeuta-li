# apps/telegram-bot/

Responsable: José

El bot que usa el administrador para hablar con el sistema en lenguaje
natural por Telegram, usando long polling (sin webhook). Aquí van los
comandos estructurados, el manejo del estado de una conversación mientras
faltan datos, y las confirmaciones explícitas antes de ejecutar una
operación sensible (cancelar, enviar correo, compartir archivo). El bot debe
poder responder con comandos estructurados aunque el modelo de NLU falle.

---

## Controles de seguridad

- **Allowlist de chats** (`src/auth.ts`): un `chat_id` fuera de
  `TELEGRAM_ALLOWED_CHAT_IDS` es un desconocido — solo catálogo público, nunca
  agenda ni datos de nadie. En producción la lista no puede estar vacía.
- **Rate limit por chat** (`src/ratelimit.ts`): ventana deslizante de 60 s.
- **Saneamiento de entrada** (`src/sanitize.ts`): NFC, sin caracteres de
  control, recorte a 1000.
- **El NLU es asesor, no autoridad**: su respuesta se re-valida (`src/nluClient.ts`)
  contra una forma mínima del contrato. Si el NLU está caído, lento o
  responde algo raro, el bot sigue con comandos estructurados.
- **Confirmación explícita** de operaciones sensibles antes de ejecutarlas
  (`src/sensitive.ts`, `src/conversation.ts`).
- **Umbral de confianza**: por debajo de `BOT_CONFIANZA_MINIMA` el bot
  repregunta en vez de actuar.
- **`allowed_updates`**: Telegram solo entrega `message` y `callback_query`
  (nada de canales ni ediciones).
- Logs con redacción de token y de texto del usuario.

## Comandos estructurados (funcionan sin NLU)

| Comando | Quién | Efecto |
|---|---|---|
| `/start` | cualquiera | saluda e informa el nivel de acceso |
| `/help` | cualquiera | lista de comandos |
| `/id` | cualquiera | muestra tu `chat_id` para pedir acceso |
| `/ping` | cualquiera | `pong` |

Texto libre (solo chats autorizados) → se interpreta con el servicio NLU.

## Desarrollo

```bash
cd apps/telegram-bot
cp .env.example .env.local        # token de @BotFather + tu chat_id
npm install
npm run dev                       # tsx watch, long polling

npm test                          # vitest (no toca Telegram: api y NLU inyectados)
npm run lint && npm run typecheck
npm run build
```

Necesita el servicio `services/nlu` corriendo (`NLU_URL`) para el texto libre;
los comandos estructurados funcionan sin él.

## Estructura

```
src/
  config.ts        env con Zod: elige token dev/demo, parsea la allowlist
  logger.ts        pino con redacción
  sanitize.ts      normaliza y limpia el texto entrante
  auth.ts          allowlist de chat_id
  ratelimit.ts     limitador por chat en memoria
  sensitive.ts     qué intenciones exigen confirmación
  nluClient.ts     llama a services/nlu y revalida la respuesta
  conversation.ts  reducer de estado: slot-filling, confirmación (sin grammY)
  commands.ts      textos de los comandos estructurados (funciones puras)
  bot.ts           ensamblado de grammY: sesión, rate limit, auth, handlers
  index.ts         arranque long polling y cierre ordenado
test/              auth, ratelimit, sanitize, nluClient, conversation, bot
```
