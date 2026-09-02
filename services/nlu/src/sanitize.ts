/**
 * Saneamiento del texto de entrada antes de mandarlo al modelo.
 * Defensa en profundidad: el bot ya debería sanear, pero el servicio NLU
 * no confía en su llamador.
 */

export const LARGO_MAX_MENSAJE = 2000;

export interface SaneadoResultado {
  texto: string;
  recortado: boolean;
}

/**
 * Elimina caracteres de control C0 (0-31) y DEL (127), conservando
 * tab (9), salto de línea (10) y retorno de carro (13).
 */
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
  if (typeof entrada !== "string") {
    return { texto: "", recortado: false };
  }
  // Normaliza a NFC para que comparaciones y longitudes sean estables.
  let t = quitarControl(entrada.normalize("NFC")).trim();

  const recortado = t.length > LARGO_MAX_MENSAJE;
  if (recortado) t = t.slice(0, LARGO_MAX_MENSAJE);

  return { texto: t, recortado };
}
