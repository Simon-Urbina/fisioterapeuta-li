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
    // `ok: false` explícito: n8n reenvía este cuerpo tal cual, y el bot
    // decide qué mostrar leyendo `ok`, no el status HTTP.
    expect(res.json()).toMatchObject({ ok: false, error: "datos_incompletos" });
    await app.close();
  });

  it("POST /vinculo-telegram con cuerpo inválido (ultimos4 no numérico) → 422", async () => {
    const app = await levantar();
    const res = await app.inject({
      method: "POST",
      url: "/vinculo-telegram",
      headers: { "x-internal-key": CLAVE },
      payload: { chat_id: 999, documento: "1052400123", ultimos4: "abcd" },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it("POST /vinculo-telegram con datos correctos → 200 y vincula", async () => {
    const { db } = crearDbFalsa([
      [{ id: 5, nombre_completo: "Laura Gómez Díaz", telefono: "3001234567" }],
      [],
      [],
    ]);
    const app = await levantar(db);
    const res = await app.inject({
      method: "POST",
      url: "/vinculo-telegram",
      headers: { "x-internal-key": CLAVE },
      payload: { chat_id: 999, documento: "1052400123", ultimos4: "4567" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      datos: { tipo: "vinculado", paciente: { id: 5, nombreEnmascarado: "Laura G." } },
    });
    await app.close();
  });

  it("POST /mantenimiento/expirar devuelve cuántos cupos liberó", async () => {
    const { db } = crearDbFalsa([[{ expirar_reservas_vencidas: 3 }]]);
    const app = await levantar(db);
    const res = await app.inject({
      method: "POST",
      url: "/mantenimiento/expirar",
      headers: { "x-internal-key": CLAVE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, datos: { liberadas: 3 } });
    await app.close();
  });

  it("POST /mantenimiento/expirar sin X-Internal-Key → 401", async () => {
    const app = await levantar();
    const res = await app.inject({ method: "POST", url: "/mantenimiento/expirar" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /mantenimiento/digest-diario responde ok (avisos vacío sin admins configurados)", async () => {
    const app = await levantar();
    const res = await app.inject({
      method: "GET",
      url: "/mantenimiento/digest-diario",
      headers: { "x-internal-key": CLAVE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, datos: { avisos: [] } });
    await app.close();
  });

  it("GET /mantenimiento/digest-diario sin X-Internal-Key → 401", async () => {
    const app = await levantar();
    const res = await app.inject({ method: "GET", url: "/mantenimiento/digest-diario" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("GET /mi-codigo-referido: chat sin vínculo → vinculado:false", async () => {
    const { db } = crearDbFalsa([[]]); // resolverPorChatId: nadie
    const app = await levantar(db);
    const res = await app.inject({
      method: "GET",
      url: "/mi-codigo-referido?chat_id=555",
      headers: { "x-internal-key": CLAVE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, datos: { vinculado: false } });
    await app.close();
  });

  it("GET /mi-codigo-referido: chat vinculado → código y avance", async () => {
    const { db } = crearDbFalsa([
      [{ id: 7, nombre_completo: "Laura Gómez", telefono: null, email: null }], // resolverPorChatId
      [{ codigo_referido: "LAUR0001", requeridos: 5, porcentaje: 10, efectivos: 2, ya_ganado: false }],
    ]);
    const app = await levantar(db);
    const res = await app.inject({
      method: "GET",
      url: "/mi-codigo-referido?chat_id=555",
      headers: { "x-internal-key": CLAVE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      ok: true,
      datos: { vinculado: true, codigo: "LAUR0001", efectivos: 2, requeridos: 5, porcentaje: 10, yaGanado: false },
    });
    await app.close();
  });

  it("GET /mi-codigo-referido sin X-Internal-Key → 401", async () => {
    const app = await levantar();
    const res = await app.inject({ method: "GET", url: "/mi-codigo-referido?chat_id=1" });
    expect(res.statusCode).toBe(401);
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
