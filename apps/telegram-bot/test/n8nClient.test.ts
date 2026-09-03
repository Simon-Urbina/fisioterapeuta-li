import { describe, it, expect, afterEach, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { ejecutarComando } from "../src/n8nClient.js";

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

describe("cliente n8n (POST /comandos vía webhook)", () => {
  it("camino feliz: ok:true con datos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(respuesta(200, { ok: true, datos: { reservaId: 77 } }))),
    );
    const r = await ejecutarComando(cfg, "crear_sesion", { cliente: "Laura" }, "111");
    expect(r).toEqual({ tipo: "ok", datos: { reservaId: 77 } });
  });

  it("envía intencion, entidades, creado_por y el header X-Internal-Key", async () => {
    const f = vi.fn(
      (..._args: [string | URL | Request, RequestInit?]): Promise<Response> =>
        Promise.resolve(respuesta(200, { ok: true, datos: null })),
    );
    vi.stubGlobal("fetch", f);
    await ejecutarComando(cfg, "cancelar_sesion", { sesion_id: 9 }, "111");
    const [url, init] = f.mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toContain(cfg.N8N_COMANDOS_PATH);
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers["x-internal-key"]).toBe(cfg.INTERNAL_API_KEY);
    const cuerpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(cuerpo).toEqual({ intencion: "cancelar_sesion", entidades: { sesion_id: 9 }, creado_por: "111" });
  });

  it("respuesta de negocio (ok:false con mensaje) -> error_negocio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          respuesta(404, { ok: false, error: "no_encontrado", mensaje: "No se encontró ese servicio." }),
        ),
      ),
    );
    const r = await ejecutarComando(cfg, "crear_sesion", {}, "111");
    expect(r).toEqual({
      tipo: "error_negocio",
      codigo: "no_encontrado",
      mensaje: "No se encontró ese servicio.",
      datos: undefined,
    });
  });

  it("timeout -> error_transporte/timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new DOMException("abort", "TimeoutError"))),
    );
    const r = await ejecutarComando(cfg, "crear_sesion", {}, "111");
    expect(r).toEqual({ tipo: "error_transporte", motivo: "timeout" });
  });

  it("falla de red -> error_transporte/red", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))),
    );
    const r = await ejecutarComando(cfg, "crear_sesion", {}, "111");
    expect(r).toEqual({ tipo: "error_transporte", motivo: "red" });
  });

  it("cuerpo con forma inválida -> error_transporte/respuesta_invalida", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respuesta(200, { algo: "raro" }))));
    const r = await ejecutarComando(cfg, "crear_sesion", {}, "111");
    expect(r).toEqual({ tipo: "error_transporte", motivo: "respuesta_invalida" });
  });
});
