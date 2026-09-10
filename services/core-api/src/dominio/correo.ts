/**
 * Arma el par `{ texto, html }` de un correo a la paciente con la misma
 * identidad visual de la web (azul de marca #0b4272, ver
 * apps/web/Fisio-Web/src/index.css). El texto plano es la fuente de la
 * verdad para clientes sin HTML; el `html` es una tabla compatible con
 * Gmail/Outlook (estilos en línea, sin flexbox ni CSS externo) que envuelve
 * el mismo contenido. Los dos salen de esta función para que nunca queden
 * desincronizados.
 *
 * Copy en español de Colombia, de usted, sin jerga — igual que el bot (ver
 * [[feedback-bot-copy]] en la memoria del proyecto).
 */

const TEL_CLINICA = "311 398 1422";
const TEL_CLINICA_E164 = "+573113981422";
const NOMBRE_CLINICA = "La Fisioterapeuta Li";

// Paleta de marca (subconjunto de --color-brand-* de la web).
const AZUL_OSCURO = "#0b4272";
const AZUL_ENLACE = "#015da7";
const ACENTO = "#0c94eb";
const FONDO = "#f0f7ff";
const TINTA = "#0f172a";
const TINTA_SUAVE = "#475569";
const TINTA_TENUE = "#64748b";

export interface DatoCorreo {
  /** Etiqueta corta, p. ej. "Cuándo", "Dónde". */
  etiqueta: string;
  valor: string;
}

export interface ContenidoCorreo {
  /** Encabezado dentro de la tarjeta (solo HTML), p. ej. "Su cita quedó confirmada". */
  titulo: string;
  /** "Hola Laura," — opcional. */
  saludo?: string;
  /** Párrafos del cuerpo, en orden. Un `\n` suelto se respeta como salto de línea. */
  parrafos: string[];
  /** Filas destacadas tipo Cuándo / Dónde. */
  datos?: DatoCorreo[];
  /** Recuadro de indicaciones previas — opcional. */
  nota?: string;
  /** Línea final antes del cierre estándar, p. ej. "La esperamos.". */
  cierre?: string;
  /**
   * Agrega al texto plano la línea de reprogramación y la firma
   * "La Fisioterapeuta Li". Por defecto `true`; se pasa `false` para el
   * comando genérico `enviar_correo`, donde el cuerpo ya viene redactado.
   */
  incluirPie?: boolean;
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parrafoTexto(p: string): string {
  return p.trim();
}

function parrafoHtml(p: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${TINTA};">${escaparHtml(
    p.trim(),
  ).replace(/\n/g, "<br>")}</p>`;
}

/** Devuelve el mismo contenido en texto plano y en HTML listo para enviar. */
export function construirCorreo(c: ContenidoCorreo): { texto: string; html: string } {
  const incluirPie = c.incluirPie ?? true;

  // --- Texto plano: bloques separados por línea en blanco, como antes. ---
  const bloques: string[] = [];
  if (c.saludo) bloques.push(c.saludo.trim());
  bloques.push(...c.parrafos.map(parrafoTexto).filter((p) => p.length > 0));
  if (c.datos?.length) {
    bloques.push(c.datos.map((d) => `${d.etiqueta}: ${d.valor}`).join("\n"));
  }
  if (c.nota) bloques.push(c.nota.trim());
  if (c.cierre) bloques.push(c.cierre.trim());
  if (incluirPie) {
    bloques.push(`Si necesita cancelar o reprogramar, escríbanos al ${TEL_CLINICA}.`);
    bloques.push(NOMBRE_CLINICA);
  }
  const texto = bloques.join("\n\n");

  // --- HTML: tabla centrada de 600px, estilos en línea. ---
  const partes: string[] = [];
  partes.push(
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${AZUL_OSCURO};">${escaparHtml(
      c.titulo,
    )}</h1>`,
  );
  if (c.saludo) {
    partes.push(
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${TINTA};">${escaparHtml(
        c.saludo.trim(),
      )}</p>`,
    );
  }
  for (const p of c.parrafos) {
    if (p.trim().length > 0) partes.push(parrafoHtml(p));
  }
  if (c.datos?.length) {
    const filas = c.datos
      .map(
        (d) =>
          `<tr>` +
          `<td style="padding:10px 16px;font-size:13px;color:${TINTA_TENUE};width:88px;vertical-align:top;">${escaparHtml(
            d.etiqueta,
          )}</td>` +
          `<td style="padding:10px 16px;font-size:14px;font-weight:600;color:${TINTA};">${escaparHtml(
            d.valor,
          )}</td>` +
          `</tr>`,
      )
      .join("");
    partes.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:${FONDO};border-radius:12px;">${filas}</table>`,
    );
  }
  if (c.nota) {
    partes.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">` +
        `<tr><td style="border-left:3px solid ${ACENTO};background:${FONDO};padding:12px 16px;border-radius:8px;font-size:14px;line-height:1.6;color:${TINTA_SUAVE};">${escaparHtml(
          c.nota.trim(),
        )}</td></tr></table>`,
    );
  }
  if (c.cierre) {
    partes.push(
      `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${TINTA};">${escaparHtml(
        c.cierre.trim(),
      )}</p>`,
    );
  }

  const html = [
    `<!DOCTYPE html>`,
    `<html lang="es"><body style="margin:0;padding:0;background:${FONDO};">`,
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escaparHtml(
      c.parrafos[0]?.trim() ?? c.titulo,
    )}</span>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FONDO};padding:24px 12px;">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">`,
    `<tr><td style="background:${AZUL_OSCURO};padding:20px 28px;">`,
    `<span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.2px;">${NOMBRE_CLINICA}</span>`,
    `</td></tr>`,
    `<tr><td style="padding:28px;">`,
    partes.join(""),
    `</td></tr>`,
    `<tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">`,
    `<p style="margin:0;font-size:12px;line-height:1.7;color:${TINTA_TENUE};">`,
    `¿Necesita cancelar o reprogramar? Escríbanos al <a href="tel:${TEL_CLINICA_E164}" style="color:${AZUL_ENLACE};text-decoration:none;">${TEL_CLINICA}</a>.<br>`,
    `${NOMBRE_CLINICA} · Este mensaje se envió automáticamente.`,
    `</p>`,
    `</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");

  return { texto, html };
}
