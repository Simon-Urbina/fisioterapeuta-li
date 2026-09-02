import type { Config } from "./config.js";

/**
 * Frontera de identidad del bot.
 *
 * Un `chat_id` fuera de la allowlist es un desconocido: puede pedir el
 * catálogo público, pero no agendar, consultar agenda ni ver datos de nadie.
 * (Alineado con `personas.vinculo_telegram` en la base: chat sin paciente
 * vinculado = desconocido.)
 */

export type NivelAcceso = "autorizado" | "desconocido";

export function nivelDeAcceso(cfg: Config, chatId: number | undefined): NivelAcceso {
  if (chatId === undefined) return "desconocido";
  return cfg.allowedChatIds.has(chatId) ? "autorizado" : "desconocido";
}

export function esAutorizado(cfg: Config, chatId: number | undefined): boolean {
  return nivelDeAcceso(cfg, chatId) === "autorizado";
}

/** Intenciones que solo tiene sentido ejecutar para un chat autorizado. */
export const INTENCIONES_RESTRINGIDAS = new Set<string>([
  "consultar_agenda",
  "consultar_disponibilidad",
  "crear_sesion",
  "modificar_sesion",
  "cancelar_sesion",
  "buscar_cliente",
  "enviar_correo",
  "crear_carpeta",
  "buscar_archivo",
  "bloquear_horario",
]);
