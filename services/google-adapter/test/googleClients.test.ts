import { describe, it, expect } from "vitest";
import { construirMimeBase64 } from "../src/googleClients.js";

function decodificar(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

describe("construirMimeBase64", () => {
  it("sin html: sale como text/plain, sin multipart", () => {
    const mime = decodificar(
      construirMimeBase64({ destinatario: "a@b.com", asunto: "Hola", texto: "Cuerpo simple" }),
    );
    expect(mime).toContain("To: a@b.com");
    expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(mime).not.toContain("multipart/alternative");
    expect(mime).toContain("Cuerpo simple");
  });

  it("codifica el asunto con acentos en base64 (RFC 2047)", () => {
    const mime = decodificar(
      construirMimeBase64({ destinatario: "a@b.com", asunto: "Confirmación", texto: "x" }),
    );
    const linea = mime.split("\r\n").find((l) => l.startsWith("Subject: "));
    expect(linea).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    const b64 = linea!.replace("Subject: =?UTF-8?B?", "").replace("?=", "");
    expect(Buffer.from(b64, "base64").toString("utf8")).toBe("Confirmación");
  });

  it("con html: multipart/alternative con las dos partes y el cierre de frontera", () => {
    const mime = decodificar(
      construirMimeBase64({
        destinatario: "paciente@correo.com",
        asunto: "Cita confirmada",
        texto: "Su cita quedó confirmada.",
        html: "<h1>Su cita quedó confirmada.</h1>",
      }),
    );

    const m = /Content-Type: multipart\/alternative; boundary="([^"]+)"/.exec(mime);
    const frontera = m?.[1];
    expect(frontera).toBeTypeOf("string");

    expect(mime).toContain(`--${frontera}\r\n`);
    expect(mime.trimEnd().endsWith(`--${frontera}--`)).toBe(true);

    // Cada parte lleva su cuerpo en base64; al decodificar vuelve el original.
    const partes = mime.split(`--${frontera}`).slice(1, -1);
    expect(partes).toHaveLength(2);

    const cuerpo = (parte: string): string => {
      const b64 = parte.split("\r\n\r\n")[1] ?? "";
      return Buffer.from(b64.replace(/\r\n/g, ""), "base64").toString("utf8");
    };
    expect(partes[0]).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(cuerpo(partes[0] ?? "")).toBe("Su cita quedó confirmada.");
    expect(partes[1]).toContain("Content-Type: text/html; charset=UTF-8");
    expect(cuerpo(partes[1] ?? "")).toBe("<h1>Su cita quedó confirmada.</h1>");
  });
});
