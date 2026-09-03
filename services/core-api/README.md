# services/core-api/

Responsable: Simón

El dominio del negocio: motor de disponibilidad, autorización, reservas y el
registro de auditoría (`operacion_log`). Es la única pieza del sistema con
permiso para decidir y ejecutar — ni n8n ni el modelo de lenguaje toman
decisiones de negocio, todas pasan por aquí.

---

## Estado actual

Scaffold funcional armado por José (bot + NLU) para desbloquear la
integración con `apps/telegram-bot`, que ya tenía el flujo de conversación
completo pero terminaba en un placeholder ("pendiente conectar la API
núcleo"). Pensado para que Simón lo revise, ajuste y tome — no reclama la
carpeta, la desbloquea.

Stack: **Node + Fastify + Zod + `pg`**, igual que `services/nlu` y
`apps/telegram-bot` (el README raíz proponía Bun + Hono; se mantiene
consistencia con lo que ya existe en el repo en vez de introducir un tercer
runtime en una hackathon corta).

## Qué hace hoy

- `POST /comandos` — único punto de ejecución de una intención ya
  interpretada por el NLU y, si era sensible, confirmada por la persona.
  Corresponde exactamente al endpoint documentado en el README raíz
  (sección 6): *"n8n envía la intención aquí; el modelo nunca"*.
  Cubre las diez intenciones de `contracts/intents.schema.json`.
- `GET /health` — hace un `SELECT 1` contra PostgreSQL.
- Autenticación entre servicios con `X-Internal-Key` (comparación de
  tiempo constante), igual que `services/nlu`.

Toda la lógica de negocio real (anti-doble-reserva, buffers, ventana de
cancelación, franjas de atención) vive en las funciones PL/pgSQL de
`db/migrations/schema.sql` (`agenda.slots_disponibles`,
`agenda.crear_reserva`, `agenda.cancelar_reserva`, …). Este servicio es
deliberadamente una capa fina: resuelve nombres en lenguaje natural
("Punción Seca", "Laura", "Tunja") a los identificadores que esas
funciones piden, valida los datos de entrada y traduce los errores de
Postgres a códigos HTTP estables.

## Qué falta / gaps conocidos

- **`modificar_sesion`** compone `cancelar_reserva` + `crear_reserva` en una
  transacción porque `schema.sql` no tiene todavía una función atómica de
  reprogramación. Funciona, pero no preserva la reserva original como "la
  misma cita" en el historial — una función SQL dedicada sería lo correcto.
- **`buscar_archivo`** devuelve `501 no_implementado`: buscar por nombre en
  Drive necesita `services/google-adapter`, que aún no existe.
  `integracion.google_recurso` es un espejo de sincronización, no un índice
  de nombres de archivo.
- **`enviar_correo` / `crear_carpeta`** no llaman a Google directamente:
  insertan en `integracion.outbox` (mismo mecanismo que ya usa el trigger
  de reservas) y quedan para que n8n + google-adapter los tomen con
  `integracion.tomar_pendientes()`.
- **`GET /servicios`, `GET /disponibilidad`, `GET /agenda`, `POST /reservas`**
  (la ruta de reserva directa desde el sitio web, sección 6 del README raíz)
  no están construidas todavía: no tienen consumidor real hasta que
  `apps/web` exista. Se documentan aquí para no perder el contrato de
  referencia, pero se prefirió no construir superficie sin quien la use.
- No hay pruebas de integración contra un Postgres real en este entorno
  (sin Docker corriendo al escribir esto). Las pruebas unitarias inyectan
  una base falsa (`test/fakeDb.ts`) que registra las consultas ejecutadas;
  falta correr `db/migrations/schema.sql` + `db/seeds/seed.sql` contra un
  Postgres local y validar los endpoints de punta a punta.
- `operacion_log` mencionado en la primera sección de este README (y en la
  sección 5 del README raíz) no existe como tabla en `db/migrations/schema.sql`
  actual — el registro forense equivalente parece ser
  `integracion.propuesta_ia` + los `RAISE EXCEPTION` con `ERRCODE`, pero no
  hay una auditoría genérica de "toda operación ejecutada". Vale la pena
  confirmarlo con Simón.

## Desarrollo local

```bash
cp .env.example .env.local   # y completar DATABASE_URL, INTERNAL_API_KEY
npm install
npm run dev                  # arranca con tsx watch en CORE_API_PORT (8000)
npm test                     # pruebas unitarias, no requieren Postgres
```
