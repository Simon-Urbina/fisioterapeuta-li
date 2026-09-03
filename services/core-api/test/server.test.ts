import { describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { construirServidor } from "../src/server.js";
import type { Db } from "../src/db.js";
import { crearDbFalsa } from "./fakeDb.js";

const CLAVE = "clave-de-pruebas-0123456789";

async function levantar(db = crearDbFalsa().db): Promise<FastifyInstance> {
  const app = construirServidor(undefined, db);
  await app.ready();
  return app;
}

describe("servidor core-api", () => {
  it("GET /health responde ok cuando la base responde", async () => {
    const app = await levantar();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ servicio: "core-api", ok: true, db: { ok: true } });
    await app.close();
  });

  it("GET /health responde 503 cuando la base falla", async () => {
    const dbQueFalla: Db = {
      query: () => Promise.reject(new Error("conexión rechazada")),
      tx: (fn) => fn(dbQueFalla),
    };
    const app = await levantar(dbQueFalla);
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ ok: false });
    await app.close();
  });

  it("POST /comandos sin X-Internal-Key → 401", async () => {
    const app = await levantar();
    const res = await app.inject({
      method: "POST",
      url: "/comandos",
      payload: { intencion: "buscar_cliente", entidades: { cliente: "Laura" } },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /comandos con clave equivocada → 401", async () => {
    const app = await levantar();
    const res = await app.inject({
      method: "POST",
      url: "/comandos",
      headers: { "x-internal-key": "otra-cosa" },
      payload: { intencion: "buscar_cliente", entidades: { cliente: "Laura" } },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("POST /comandos con cuerpo inválido (intención inexistente) → 422", async () => {
    const app = await levantar();
    const res = await app.inject({
      method: "POST",
      url: "/comandos",
      headers: { "x-internal-key": CLAVE },
      payload: { intencion: "borrar_todo", entidades: {} },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("POST /comandos con intención 'desconocida' → 422 (el bot nunca debe reenviarla)", async () => {
    const app = await levantar();
    const res = await app.inject({
      method: "POST",
      url: "/comandos",
      headers: { "x-internal-key": CLAVE },
      payload: { intencion: "desconocida", entidades: {} },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("POST /comandos autenticado y válido → 200 con el resultado del dominio", async () => {
    const { db } = crearDbFalsa([[{ id: 1, nombre_completo: "Laura Gómez", telefono: null }]]);
    const app = await levantar(db);
    const res = await app.inject({
      method: "POST",
      url: "/comandos",
      headers: { "x-internal-key": CLAVE },
      payload: { intencion: "buscar_cliente", entidades: { cliente: "Laura" }, creado_por: "bot-telegram" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, datos: { candidatos: [{ nombreCompleto: "Laura Gómez" }] } });
    await app.close();
  });

  it("POST /comandos con datos incompletos → status del error de dominio (422)", async () => {
    const app = await levantar();
    const res = await app.inject({
      method: "POST",
      url: "/comandos",
      headers: { "x-internal-key": CLAVE },
      payload: { intencion: "crear_sesion", entidades: { cliente: "Laura" } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "datos_incompletos" });
    await app.close();
  });

  it("ruta inexistente → 404 sin filtrar detalles", async () => {
    const app = await levantar();
    const res = await app.inject({ method: "GET", url: "/no-existe", headers: { "x-internal-key": CLAVE } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "no_encontrado" });
    await app.close();
  });
});
