import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { construirServidor } from "./server.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const app = construirServidor(cfg);

  if (!cfg.INTERNAL_API_KEY) {
    logger.warn(
      "INTERNAL_API_KEY no está definido: /interpretar queda SIN autenticación. Solo aceptable en desarrollo local.",
    );
  }

  await app.listen({ port: cfg.NLU_PORT, host: cfg.NLU_HOST });
  logger.info(`servicio NLU escuchando en http://${cfg.NLU_HOST}:${cfg.NLU_PORT}`);

  for (const señal of ["SIGINT", "SIGTERM"] as const) {
    process.once(señal, () => {
      logger.info(`${señal} recibido, cerrando…`);
      app.close().then(
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
