import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { construirServidor } from "../src/server.js";

const CLAVE = "clave-de-pruebas-0123456789";

function respJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Stub de fetch que imita a Ollama según la ruta. */
function stubOllama(contenidoChat: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/tags")) {
        return Promise.resolve(respJson({ models: [{ name: "modelo-test" }] }));
      }
      if (url.endsWith("/api/chat")) {
        return Promise.resolve(
          respJson({ message: { content: contenidoChat }, model: "modelo-test" }),
        );
      }
      return Promise.reject(new Error(`ruta no esperada: ${url}`));
    }),
  );
}

let app: FastifyInstance;

beforeEach(async () => {
  app = construirServidor();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

describe("servidor NLU", () => {
  it("GET /health responde ok e informa el estado de Ollama", async () => {
    stubOllama("{}");
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ servicio: "nlu", ok: true, ollama: { ok: true } });
  });

  it("POST /interpretar sin X-Internal-Key → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/interpretar",
      payload: { mensaje: "hola" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /interpretar con clave equivocada → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/interpretar",
      headers: { "x-internal-key": "otra-cosa" },
      payload: { mensaje: "hola" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /interpretar con cuerpo inválido → 422", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/interpretar",
      headers: { "x-internal-key": CLAVE },
      payload: { mensaje: 123 },
    });
    expect(res.statusCode).toBe(422);
  });

  it("POST /interpretar autenticado y con JSON del modelo válido → 200 con contrato + _meta", async () => {
    stubOllama(
      JSON.stringify({
        intencion: "consultar_agenda",
        entidades: { fecha: "2026-09-01" },
        confianza: 0.9,
        faltantes: [],
      }),
    );
    const res = await app.inject({
      method: "POST",
      url: "/interpretar",
      headers: { "x-internal-key": CLAVE },
      payload: { mensaje: "que tengo hoy", hoy: "2026-09-01" },
    });
    expect(res.statusCode).toBe(200);
    const body: Record<string, unknown> = res.json();
    expect(body["intencion"]).toBe("consultar_agenda");
    expect(body["_meta"]).toMatchObject({ uso_fallback: false, modelo: "modelo-test" });
  });

  it("ruta inexistente → 404 sin filtrar detalles", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/no-existe",
      headers: { "x-internal-key": CLAVE },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "no_encontrado" });
  });
});
