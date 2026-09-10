/**
 * Utilidades para que los logs no filtren datos de pacientes.
 *
 * El servicio NLU ve texto libre escrito por personas: nombres, teléfonos,
 * correos, a veces motivos de consulta. Nada de eso debe quedar en claro en
 * los registros. Se guarda solo lo necesario para depurar: longitud, hash
 * corto y una versión enmascarada.
 */
import { createHash } from "node:crypto";

const CORREO = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Secuencias de 7+ dígitos (teléfonos, documentos), con separadores comunes.
const NUMERO_LARGO = /\b(?:\d[\d .-]{5,}\d)\b/g;

/** Hash corto y estable de un texto, para correlacionar sin exponer contenido. */
export function huella(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex").slice(0, 12);
}

/** Enmascara correos y números largos dentro de un texto. */
export function enmascarar(texto: string): string {
  return texto
    .replace(CORREO, "«correo»")
    .replace(NUMERO_LARGO, "«numero»");
}

/**
 * Representación segura de un mensaje de usuario para logs:
 * sin contenido literal, solo metadatos y un extracto enmascarado y recortado.
 */
export function mensajeParaLog(texto: string): {
  huella: string;
  longitud: number;
  extracto: string;
} {
  const limpio = enmascarar(texto);
  return {
    huella: huella(texto),
    longitud: texto.length,
    extracto: limpio.length > 80 ? `${limpio.slice(0, 80)}…` : limpio,
  };
}
