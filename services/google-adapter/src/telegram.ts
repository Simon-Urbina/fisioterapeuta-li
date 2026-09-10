/**
 * Lo mínimo de la API de Telegram para bajar la foto de un comprobante por
 * su `file_id` y subirla a Drive. NO manda mensajes ni recibe updates: eso
 * es de apps/telegram-bot. Solo lectura de archivos.
 */

const MIME_POR_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

function mimePorRuta(ruta: string): string {
  const ext = ruta.split(".").pop()?.toLowerCase() ?? "";
  return MIME_POR_EXT[ext] ?? "application/octet-stream";
}

export interface ArchivoTelegram {
  contenido: Buffer;
  mimeType: string;
  /** Nombre sugerido, derivado de la ruta que da Telegram (p. ej. "file_12.jpg"). */
  nombreSugerido: string;
}

/**
 * `getFile` → `file_path`, luego descarga el binario. El `file_path` de
 * Telegram caduca (~1 h), pero acá se usa de inmediato.
 */
export async function descargarArchivoTelegram(token: string, fileId: string): Promise<ArchivoTelegram> {
  const meta = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!meta.ok) throw new Error(`Telegram getFile respondió ${String(meta.status)}`);
  const metaJson = (await meta.json()) as { ok: boolean; result?: { file_path?: string } };
  const filePath = metaJson.result?.file_path;
  if (!metaJson.ok || !filePath) throw new Error("Telegram getFile no devolvió file_path.");

  const bin = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!bin.ok) throw new Error(`Descarga del archivo de Telegram respondió ${String(bin.status)}`);
  const contenido = Buffer.from(await bin.arrayBuffer());

  return {
    contenido,
    mimeType: mimePorRuta(filePath),
    nombreSugerido: filePath.split("/").pop() ?? "comprobante",
  };
}
