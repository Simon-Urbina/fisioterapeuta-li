import { describe, it, expect, beforeEach } from "vitest";
import type { Update, UserFromGetMe } from "grammy/types";
import { loadConfig } from "../src/config.js";
import { crearBot } from "../src/bot.js";
import type { ResultadoNlu } from "../src/nluClient.js";
import type { ResultadoEjecucion } from "../src/n8nClient.js";

const cfg = loadConfig(); // allowlist de pruebas: 111,222

const botInfo = {
  id: 42,
  is_bot: true,
  first_name: "test",
  username: "fisio_test_bot",
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
} as unknown as UserFromGetMe;

type ClienteN8nPrueba = (
  c: unknown,
  intencion: string,
  entidades: Record<string, string | number>,
  creadoPor: string,
) => Promise<ResultadoEjecucion>;

function crearBotDePrueba(nlu?: (c: unknown, m: string) => Promise<ResultadoNlu>, n8n?: ClienteN8nPrueba) {
  const enviados: string[] = [];
  const bot = crearBot(cfg, {
    botInfo,
    ...(nlu ? { nlu } : {}),
    ...(n8n ? { n8n } : {}),
  });
  bot.api.config.use((_prev, method, payload) => {
    if (method === "sendMessage") {
      enviados.push((payload as { text: string }).text);
    }
    return Promise.resolve({ ok: true, result: {} } as never);
  });
  return { bot, enviados };
}

let updateId = 0;
function updateTexto(text: string, chatId: number): Update {
  updateId += 1;
  const esComando = text.startsWith("/");
  const update = {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: "private", first_name: "Persona" },
      from: { id: chatId, is_bot: false, first_name: "Persona" },
      text,
      ...(esComando
        ? { entities: [{ type: "bot_command", offset: 0, length: text.length }] }
        : {}),
    },
  };
  return update as unknown as Update;
}

beforeEach(() => {
  updateId = 0;
});

describe("bot (integración)", () => {
  it("/ping responde pong a cualquiera", async () => {
    const { bot, enviados } = crearBotDePrueba();
    await bot.handleUpdate(updateTexto("/ping", 999));
    expect(enviados).toEqual(["pong"]);
  });

  it("/id devuelve el chat_id", async () => {
    const { bot, enviados } = crearBotDePrueba();
    await bot.handleUpdate(updateTexto("/id", 777));
    expect(enviados[0]).toContain("777");
  });

  it("texto libre de un chat NO autorizado es rechazado y no llama al NLU", async () => {
    let nluLlamado = false;
    const nlu = () => {
      nluLlamado = true;
      return Promise.resolve({ ok: true, intencion: { intencion: "consultar_agenda", entidades: {}, confianza: 1, faltantes: [] } } as ResultadoNlu);
    };
    const { bot, enviados } = crearBotDePrueba(nlu);
    await bot.handleUpdate(updateTexto("¿qué citas hay hoy?", 500));
    expect(nluLlamado).toBe(false);
    expect(enviados[0]).toContain("no está autorizado");
  });

  it("texto libre de un chat autorizado sí pasa por el NLU y ejecuta vía n8n", async () => {
    const nlu = () =>
      Promise.resolve({
        ok: true,
        intencion: { intencion: "consultar_agenda", entidades: { fecha: "2026-09-01" }, confianza: 0.95, faltantes: [] },
      } as ResultadoNlu);
    let n8nLlamadoCon: unknown = null;
    const n8n: ClienteN8nPrueba = (_c, intencion, entidades) => {
      n8nLlamadoCon = { intencion, entidades };
      return Promise.resolve({ tipo: "ok", datos: { citas: [] } } as ResultadoEjecucion);
    };
    const { bot, enviados } = crearBotDePrueba(nlu, n8n);
    await bot.handleUpdate(updateTexto("¿qué tengo hoy?", 111));
    expect(n8nLlamadoCon).toEqual({ intencion: "consultar_agenda", entidades: { fecha: "2026-09-01" } });
    expect(enviados[0]).toBe("No hay citas en ese rango.");
  });

  it("una intención sensible (crear_sesion) pide confirmación y solo llama a n8n tras el sí", async () => {
    const nlu = () =>
      Promise.resolve({
        ok: true,
        intencion: {
          intencion: "cancelar_sesion",
          entidades: { sesion_id: 9 },
          confianza: 0.95,
          faltantes: [],
        },
      } as ResultadoNlu);
    let n8nLlamado = false;
    const n8n: ClienteN8nPrueba = () => {
      n8nLlamado = true;
      return Promise.resolve({ tipo: "ok", datos: { estado: "cancelada_a_tiempo" } } as ResultadoEjecucion);
    };
    const { bot, enviados } = crearBotDePrueba(nlu, n8n);

    await bot.handleUpdate(updateTexto("cancela mi cita 9", 111));
    expect(n8nLlamado).toBe(false); // todavía no confirmó
    expect(enviados[0]).toContain("¿Confirmas?");

    await bot.handleUpdate(updateTexto("sí", 111));
    expect(n8nLlamado).toBe(true);
    expect(enviados[1]).toContain("cancelada_a_tiempo");
  });

  it("si n8n falla (transporte), avisa sin filtrar detalles técnicos", async () => {
    const nlu = () =>
      Promise.resolve({
        ok: true,
        intencion: { intencion: "consultar_agenda", entidades: {}, confianza: 0.95, faltantes: [] },
      } as ResultadoNlu);
    const n8n: ClienteN8nPrueba = () => Promise.resolve({ tipo: "error_transporte", motivo: "red" } as ResultadoEjecucion);
    const { bot, enviados } = crearBotDePrueba(nlu, n8n);
    await bot.handleUpdate(updateTexto("¿qué tengo hoy?", 111));
    expect(enviados[0]).toContain("No pude completar la acción");
  });

  it("aplica rate limit por chat", async () => {
    const { bot, enviados } = crearBotDePrueba();
    for (let i = 0; i < cfg.BOT_RATE_LIMIT_POR_MINUTO + 5; i += 1) {
      await bot.handleUpdate(updateTexto("/ping", 111));
    }
    expect(enviados.length).toBe(cfg.BOT_RATE_LIMIT_POR_MINUTO);
  });
});
