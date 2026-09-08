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

## Workflows

| Archivo | Qué hace | Estado |
| :---- | :---- | :---- |
| `recibir-comando.json` | Webhook `POST /webhook/comandos` ← el bot; reenvía a `core-api POST /comandos` con `X-Internal-Key` y responde el cuerpo tal cual. El bot lee `ok`, no el status HTTP. | Activo |
| `mantenimiento-expirar-reservas.json` | Schedule cada 5 min → `core-api POST /mantenimiento/expirar` (libera cupos de reservas sin pagar). Es el mismo `SELECT agenda.expirar_reservas_vencidas()` que ya corría en un `setInterval` dentro de `core-api/src/index.ts`; ahora n8n es el disparador visible. Correr los dos a la vez es inofensivo (la función solo toca reservas ya vencidas). | Activo |
| `recordatorios-24h.json` | Schedule cada 15 min → `POST /recordatorios/reclamar` → Split Out → **IF** `chatId` no vacío: rama sí = nodo Telegram + `POST /recordatorios/marcar-enviado`; rama no = `POST /recordatorios/enviar-email`. | Activo |
| `avisos-confirmacion-telegram.json` | Schedule cada 2 min → `GET /confirmaciones-telegram/pendientes` → Split Out → nodo Telegram → `POST /confirmaciones-telegram/marcar`. Aviso de "cita confirmada" cuando se confirmó desde el panel web. | Activo |
| `avisos-referidos-telegram.json` | Schedule cada 2 min → `GET /avisos-telegram/pendientes` → Split Out → nodo Telegram → `POST /avisos-telegram/marcar`. Hoy: felicitación por el descuento de referidos. | Activo |

El cuerpo de cada mensaje de Telegram lo compone **core-api** (campo
`mensajeTelegram` en la respuesta de `/recordatorios/reclamar` y
`/confirmaciones-telegram/pendientes`; `texto` en `/avisos-telegram/pendientes`).
El nodo de n8n solo lo reenvía — así el texto es idéntico lo mande el bot o
n8n, y n8n no contiene lógica de negocio (regla 4).

El nodo **Telegram** usa una credencial `telegramApi` creada a mano en la
interfaz (token del bot de desarrollo). Los `.json` la referencian por id
(`xqHTHtpRqUjUSwQT`); si se recrea la credencial, ese id cambia y hay que
corregirlo en los tres workflows.

Con estos tres activos, el bot NO debe barrer lo mismo: poner
`BOT_VIGILANCIA_NOTIFICACIONES=false` en `apps/telegram-bot/.env.local`
(el barrido de PAGOS del bot no se toca — es interactivo). Tener los dos
barridos un rato es seguro (el "reclamar" en la base es atómico), pero
duplica trabajo.

### Pendiente (plan)

- `digest-diario-lina` — Schedule 7:00 America/Bogota → `GET /citas/hoy` →
  Telegram a Lina con el resumen del día. Falta componer el texto en
  core-api (`mensajeTelegram`) y armar el workflow.

### Workflows hechos a mano

Los `.json` de este repo están escritos a mano en su forma mínima (sin los
metadatos que agrega `export:workflow`: `versionId`, `shared`, timestamps).
Importan igual y son más fáciles de leer y revisar en un PR. Si editás uno
desde la interfaz de n8n, exportá con `scripts/exportar-n8n.sh` y limpiá los
metadatos, o volvé a dejar la versión mínima.

## Importar / exportar workflows

`docker-compose.yml` monta `automation/n8n/workflows/` en `/workflows`
dentro del contenedor.

```bash
# Exportar lo que está en n8n al repo (SIN credenciales):
bash scripts/exportar-n8n.sh

# Importar un workflow del repo a n8n:
docker exec fisio-n8n n8n import:workflow --input=/workflows/<archivo>.json
docker restart fisio-n8n   # para que registre el Schedule / webhook
```

Gotchas encontrados (n8n 2.37, Docker Desktop en Windows):

- **El JSON debe traer un `"id"`** (string). Sin él, `import:workflow` falla
  con `NOT NULL constraint failed: workflow_entity.id`. Los de este repo ya
  lo traen; al crear uno nuevo, poné un id corto y único.
- **`import:workflow` siempre deja el workflow inactivo.** Después:
  `docker exec fisio-n8n n8n update:workflow --id=<id> --active=true` y
  `docker restart fisio-n8n`. El flag `--activeState=fromJson` solo sirve en
  modo queue/multi-main, no en el modo normal.
- **Git Bash reescribe rutas tipo `/workflows/...`** a `C:/Program Files/Git/...`.
  Prefijá el comando con `MSYS_NO_PATHCONV=1`.
- Si el contenedor ve `/workflows` desactualizado (archivos viejos, cambios
  del host que no aparecen), es la sincronización de Docker Desktop trabada:
  cerrar y reabrir Docker Desktop entero.
- `recibir-comando.json` en el repo trae la clave placeholder
  `clave_compartida_entre_servicios_internos`; el workflow vivo usa la real
  de `.env.local` (`INTERNAL_API_KEY`). Al reimportar desde el repo hay que
  corregir el header, o exportar de nuevo con `exportar-n8n.sh`.
