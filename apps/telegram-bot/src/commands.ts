import type { NivelAcceso } from "./auth.js";

/**
 * Comandos estructurados. Son funciones puras que devuelven texto: funcionan
 * aunque el servicio NLU esté caído.
 */

export const AYUDA = [
  "Comandos:",
  "/start — inicia y muestra tu estado de acceso",
  "/help — esta ayuda",
  "/id — muestra tu chat_id (para pedir acceso al administrador)",
  "/ping — comprueba que el bot responde",
  "",
  "Si tenés acceso, también podés escribir en lenguaje natural:",
  '  «¿qué citas tengo mañana?»  ·  «agenda a Laura para el viernes 3pm»',
  "",
  "Las acciones sensibles (cancelar, reprogramar, enviar correo) piden",
  "confirmación explícita antes de ejecutarse.",
].join("\n");

export function inicio(nivel: NivelAcceso): string {
  if (nivel === "autorizado") {
    return "Listo. Tenés acceso de administrador. Escribí lo que necesitás o usá /help.";
  }
  return [
    "Hola. Este bot es de uso interno de La Fisioterapeuta Li.",
    "Tu chat no está autorizado, así que solo podés consultar información pública.",
    "Si necesitás acceso, pasale tu /id al administrador.",
  ].join("\n");
}

export function miId(chatId: number | undefined): string {
  return chatId === undefined
    ? "No pude determinar tu chat_id."
    : `Tu chat_id es: ${chatId}`;
}

export const PONG = "pong";

export function noAutorizado(): string {
  return "Tu chat no está autorizado para esta acción. Usá /id y pedí acceso al administrador.";
}
