/** Saneamiento del texto que llega por Telegram antes de procesarlo. */

export const LARGO_MAX_MENSAJE = 1000;

export interface SaneadoResultado {
  texto: string;
  recortado: boolean;
}

/** Quita controles C0 (0-31) y DEL (127), conservando tab/LF/CR. */
function quitarControl(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    const esControl = (code >= 0 && code <= 31) || code === 127;
    const permitido = code === 9 || code === 10 || code === 13;
    if (!esControl || permitido) out += ch;
  }
  return out;
}

export function sanearMensaje(entrada: unknown): SaneadoResultado {
  if (typeof entrada !== "string") return { texto: "", recortado: false };
  let t = quitarControl(entrada.normalize("NFC")).trim();
  const recortado = t.length > LARGO_MAX_MENSAJE;
  if (recortado) t = t.slice(0, LARGO_MAX_MENSAJE);
  return { texto: t, recortado };
}
