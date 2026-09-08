import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { construirDb, cerrarDb } from "./db.js";
import { construirServidor } from "./server.js";
import {
  construirOAuth2Client,
  construirGmailClient,
  construirCalendarClient,
  construirSheetsClient,
} from "./googleClients.js";
import { procesarPendientes, type ClientesGoogle } from "./consumer.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const db = construirDb(cfg);

  let detener = false;

  // Los clientes de Google se construyen ANTES del servidor para poder
  // pasárselos a POST /outbox/procesar. Sin credenciales quedan undefined
  // (ese endpoint responde 503 y no hay poll).
  let clientes: ClientesGoogle | undefined;
  if (!cfg.GOOGLE_CLIENT_ID || !cfg.GOOGLE_CLIENT_SECRET || !cfg.GOOGLE_REFRESH_TOKEN) {
    logger.warn(
      "Faltan credenciales de Google (GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN): el consumidor de integracion.outbox queda apagado. Corré 'npm run setup-oauth' — ver README.md.",
    );
  } else {
    const auth = construirOAuth2Client(cfg, cfg.GOOGLE_REFRESH_TOKEN);
    clientes = {
      gmail: construirGmailClient(auth),
      calendar: construirCalendarClient(auth),
      sheets: construirSheetsClient(auth),
      sheetsSpreadsheetId: cfg.GOOGLE_SHEETS_SPREADSHEET_ID,
    };
    if (!cfg.GOOGLE_SHEETS_SPREADSHEET_ID) {
      logger.warn(
        "GOOGLE_SHEETS_SPREADSHEET_ID no configurado: los respaldos de reservas en Sheets quedarán en 'fallido' hasta que se agregue.",
      );
    }
  }

  const app = construirServidor(db, cfg, undefined, clientes);
  await app.listen({ port: cfg.GOOGLE_ADAPTER_PORT, host: cfg.GOOGLE_ADAPTER_HOST });
  logger.info(`google-adapter escuchando en http://${cfg.GOOGLE_ADAPTER_HOST}:${cfg.GOOGLE_ADAPTER_PORT}`);

  // El `setInterval` propio solo corre si hay clientes Y OUTBOX_POLL != "false".
  // Con "false", quien dispara el ciclo es n8n (POST /outbox/procesar).
  if (clientes && cfg.GOOGLE_ADAPTER_OUTBOX_POLL !== "false") {
    const clientesPoll = clientes;
    let enCurso = false;
    const tick = (): void => {
      if (enCurso || detener) return;
      enCurso = true;
      procesarPendientes(db, clientesPoll, cfg.OUTBOX_LOTE, cfg.TIMEZONE)
        .then((r) => {
          if (r.tomados > 0) {
            logger.info(r, "lote de outbox procesado");
          }
        })
        .catch((err: unknown) => {
          logger.error({ err: err instanceof Error ? err.message : String(err) }, "fallo procesando el outbox");
        })
        .finally(() => {
          enCurso = false;
        });
    };
    const intervalo = setInterval(tick, cfg.OUTBOX_POLL_INTERVAL_MS);
    tick();
    logger.info(`consumidor de integracion.outbox activo cada ${cfg.OUTBOX_POLL_INTERVAL_MS}ms`);

    for (const señal of ["SIGINT", "SIGTERM"] as const) {
      process.once(señal, () => {
        detener = true;
        clearInterval(intervalo);
      });
    }
  } else if (clientes) {
    logger.info("GOOGLE_ADAPTER_OUTBOX_POLL=false: el outbox lo dispara n8n vía POST /outbox/procesar.");
  }

  for (const señal of ["SIGINT", "SIGTERM"] as const) {
    process.once(señal, () => {
      logger.info(`${señal} recibido, cerrando…`);
      app
        .close()
        .then(() => cerrarDb())
        .then(
          () => process.exit(0),
          () => process.exit(1),
        );
    });
  }
}

main().catch((err: unknown) => {
  logger.fatal({ err: err instanceof Error ? err.message : String(err) }, "no se pudo arrancar");
  process.exit(1);
});
