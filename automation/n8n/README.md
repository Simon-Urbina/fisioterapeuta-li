# automation/n8n/

Responsable: Valentina (ver [[jose-scope]] / `DUENOS.md` — José asumió esta
carpeta también, 2026-09-02).

Los flujos de n8n que mueven datos y disparan acciones después de que algo
ya fue decidido por la API núcleo: correo de confirmación, registro en
Sheets, avisos por Telegram y recordatorios programados. n8n no contiene
reglas de negocio — si un nodo necesita decidir algo, esa lógica pertenece a
`services/core-api/`. Los workflows solo existen en la máquina donde se
crean hasta que se exportan a `workflows/` y se suben con
`scripts/exportar-n8n.sh`.

## Pendiente: workflow "recibir comando" (bloquea la integración del bot)

`apps/telegram-bot` ya llama a `N8N_URL + N8N_COMANDOS_PATH`
(`/webhook/comandos` por defecto) cuando el usuario confirma una acción
(ver `src/n8nClient.ts`). Falta el workflow del lado de n8n:

1. **Webhook** — `POST /webhook/comandos`, `responseMode: responseNode`.
2. **HTTP Request** — `POST {{CORE_API_URL}}/comandos`, header
   `X-Internal-Key` (credencial "HTTP Header Auth", ver
   `credentials.example.json`), body = el mismo JSON que llegó al webhook
   (`{ intencion, entidades, creado_por }`).
3. **Respond to Webhook** — responde con el cuerpo tal cual lo devolvió
   core-api (`{ ok, datos, error, mensaje }`); el bot decide el mensaje al
   usuario leyendo ese `ok`, no el status HTTP.

No se dejó como `.json` en `workflows/` a propósito: se arma en la interfaz
de n8n (con Docker levantado) y se exporta con `scripts/exportar-n8n.sh`,
como dice la sección de abajo — escribirlo a mano sin poder importarlo y
probarlo era más riesgo que ayuda.
