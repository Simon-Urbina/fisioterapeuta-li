import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { crearBot } from "./bot.js";
import { coreApi } from "./coreApiClient.js";
import { iniciarVigilanciaPagos } from "./telegram/vigilanciaPagos.js";
import { iniciarVigilanciaRecordatorios } from "./telegram/vigilanciaRecordatorios.js";
import { iniciarVigilanciaConfirmaciones } from "./telegram/vigilanciaConfirmaciones.js";
import { iniciarVigilanciaAvisos } from "./telegram/vigilanciaAvisos.js";

function main(): void {
  const cfg = loadConfig();
  const bot = crearBot(cfg);

  if (cfg.allowedChatIds.size === 0) {
    logger.warn(
      "TELEGRAM_ALLOWED_CHAT_IDS está vacío: nadie tiene acceso administrativo (agenda completa, bloquear horario, etc.). Configúralo con tu /id.",
    );
  }

  // Le avisa a Lina por Telegram cuando entra un pago desde el checkout de la
  // web (ver telegram/vigilanciaPagos.ts). Este SIEMPRE lo hace el bot: es
  // interactivo (Lina confirma/rechaza desde el chat).
  const detenerVigilancia = iniciarVigilanciaPagos(bot, { cfg, cApi: coreApi });

  // Recordatorio 24h, aviso de "cita confirmada" desde la web y avisos
  // simples. Con BOT_VIGILANCIA_NOTIFICACIONES=false los orquesta n8n
  // (automation/n8n/) y el bot no los barre, para no duplicar.
  const noBarrer = (): void => {
    /* no se inició este barrido: no hay timer que limpiar */
  };
  const notificacionesLasOrquestaN8n = cfg.BOT_VIGILANCIA_NOTIFICACIONES === "false";

  const detenerRecordatorios = notificacionesLasOrquestaN8n
    ? noBarrer
    : iniciarVigilanciaRecordatorios(bot, { cfg, cApi: coreApi });

  const detenerConfirmaciones = notificacionesLasOrquestaN8n
    ? noBarrer
    : iniciarVigilanciaConfirmaciones(bot, { cfg, cApi: coreApi });

  const detenerAvisos = notificacionesLasOrquestaN8n
    ? noBarrer
    : iniciarVigilanciaAvisos(bot, { cfg, cApi: coreApi });

  if (notificacionesLasOrquestaN8n) {
    logger.info(
      "BOT_VIGILANCIA_NOTIFICACIONES=false: recordatorios, confirmaciones y avisos los orquesta n8n; el bot no los barre.",
    );
  }

  for (const señal of ["SIGINT", "SIGTERM"] as const) {
    process.once(señal, () => {
      logger.info(`${señal} recibido, deteniendo el bot…`);
      detenerVigilancia();
      detenerRecordatorios();
      detenerConfirmaciones();
      detenerAvisos();
      void bot.stop();
    });
  }

  // Menú nativo de Telegram (botón "/"). Solo lo que le sirve al paciente;
  // /id y /ping siguen funcionando pero no se listan.
  void bot.api
    .setMyCommands([
      { command: "start", description: "Menú principal" },
      { command: "agendar", description: "Pedir una cita" },
      { command: "miscitas", description: "Ver mis citas" },
      { command: "cancelarcita", description: "Cancelar una cita" },
      { command: "referido", description: "Mi código de referido" },
      { command: "servicios", description: "Servicios y precios" },
      { command: "info", description: "Información del consultorio" },
      { command: "cancelar", description: "Cancelar lo que estemos haciendo" },
      { command: "ayuda", description: "Cómo funciona" },
    ])
    .catch((err: unknown) => {
      logger.warn(
        { err: err instanceof Error ? err.message : "desconocido" },
        "no se pudo registrar el menú de comandos",
      );
    });

  // Menú nativo aparte para el personal (scope por chat): SOLO los comandos
  // administrativos — un chat autorizado no ve ni usa el bot "de paciente"
  // (ver el middleware en bot.ts que lo bloquea aunque lo escriba a mano).
  for (const chatId of cfg.allowedChatIds) {
    void bot.api
      .setMyCommands(
        [
          { command: "start", description: "Menú principal" },
          { command: "hoy", description: "Agenda de hoy" },
          { command: "pagos", description: "Pagos pendientes por verificar" },
          { command: "historia", description: "Historia clínica por número de documento" },
          { command: "ayuda", description: "Ayuda" },
        ],
        { scope: { type: "chat", chat_id: chatId } },
      )
      .catch((err: unknown) => {
        logger.warn(
          { chatId, err: err instanceof Error ? err.message : "desconocido" },
          "no se pudo registrar el menú de comandos del personal",
        );
      });
  }

  logger.info(
    { entorno: cfg.TELEGRAM_ENTORNO, autorizados: cfg.allowedChatIds.size },
    "arrancando bot en long polling",
  );

  // allowed_updates acota lo que Telegram entrega: nada de canal ni ediciones.
  void bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: (info) => {
      logger.info({ usuario: info.username }, "bot conectado");
    },
  });
}

main();
