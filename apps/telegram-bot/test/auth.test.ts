import { describe, it, expect } from "vitest";
import { loadConfig, _resetConfigForTests } from "../src/config.js";
import { esAutorizado, nivelDeAcceso } from "../src/auth.js";

function cfgCon(ids: string) {
  _resetConfigForTests();
  return loadConfig({ ...process.env, TELEGRAM_ALLOWED_CHAT_IDS: ids });
}

describe("allowlist de chats", () => {
  it("acepta un chat en la lista", () => {
    const cfg = cfgCon("111, 222 , 333");
    expect(esAutorizado(cfg, 222)).toBe(true);
    expect(nivelDeAcceso(cfg, 222)).toBe("autorizado");
  });

  it("rechaza un chat fuera de la lista", () => {
    const cfg = cfgCon("111,222");
    expect(esAutorizado(cfg, 999)).toBe(false);
    expect(nivelDeAcceso(cfg, 999)).toBe("desconocido");
  });

  it("chat_id indefinido es desconocido", () => {
    const cfg = cfgCon("111");
    expect(esAutorizado(cfg, undefined)).toBe(false);
  });

  it("ignora entradas no numéricas de la lista", () => {
    const cfg = cfgCon("111,abc,,  ,222");
    expect(cfg.allowedChatIds).toEqual(new Set([111, 222]));
  });
});
