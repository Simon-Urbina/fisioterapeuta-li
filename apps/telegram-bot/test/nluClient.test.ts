import { describe, it, expect, afterEach, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { interpretar } from "../src/nluClient.js";

const cfg = loadConfig();

function respuesta(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cliente NLU", () => {
  it("camino feliz: devuelve la intención validada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          respuesta(200, {
            intencion: "consultar_agenda",
            entidades: { fecha: "2026-09-01" },
            confianza: 0.9,
            faltantes: [],
            _meta: { modelo: "x" },
          }),
        ),
      ),
    );
    const r = await interpretar(cfg, "que tengo hoy");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.intencion.intencion).toBe("consultar_agenda");
      expect(r.intencion.entidades["fecha"]).toBe("2026-09-01");
    }
  });

  it("envía el header X-Internal-Key", async () => {
    const f = vi.fn(
      (..._args: [string | URL | Request, RequestInit?]): Promise<Response> =>
        Promise.resolve(
          respuesta(200, {
            intencion: "desconocida",
            entidades: {},
            confianza: 0,
            faltantes: [],
          }),
        ),
    );
    vi.stubGlobal("fetch", f);
    await interpretar(cfg, "hola");
    const init = f.mock.calls[0]?.[1];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["x-internal-key"]).toBe(cfg.INTERNAL_API_KEY);
  });

  it("timeout -> motivo 'timeout'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new DOMException("abort", "TimeoutError"))),
    );
    const r = await interpretar(cfg, "hola");
    expect(r).toEqual({ ok: false, motivo: "timeout" });
  });

  it("HTTP 500 -> motivo 'http'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respuesta(500, { error: "x" }))));
    const r = await interpretar(cfg, "hola");
    expect(r).toEqual({ ok: false, motivo: "http" });
  });

  it("respuesta con forma inválida -> 'respuesta_invalida'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(respuesta(200, { intencion: "inventada", confianza: 5 }))),
    );
    const r = await interpretar(cfg, "hola");
    expect(r).toEqual({ ok: false, motivo: "respuesta_invalida" });
  });
});
