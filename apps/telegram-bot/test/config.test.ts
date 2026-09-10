import { describe, it, expect, afterEach } from "vitest";
import { loadConfig, _resetConfigForTests } from "../src/config.js";

afterEach(() => {
  _resetConfigForTests();
});

describe("BOT_VIGILANCIA_NOTIFICACIONES", () => {
  it("por defecto es 'true' (el bot barre recordatorios/confirmaciones/avisos)", () => {
    _resetConfigForTests();
    const cfg = loadConfig({ ...process.env, BOT_VIGILANCIA_NOTIFICACIONES: undefined });
    expect(cfg.BOT_VIGILANCIA_NOTIFICACIONES).toBe("true");
  });

  it("acepta 'false' para dejarle esos barridos a n8n", () => {
    _resetConfigForTests();
    const cfg = loadConfig({ ...process.env, BOT_VIGILANCIA_NOTIFICACIONES: "false" });
    expect(cfg.BOT_VIGILANCIA_NOTIFICACIONES).toBe("false");
  });

  it("rechaza un valor que no sea 'true' ni 'false'", () => {
    _resetConfigForTests();
    expect(() => loadConfig({ ...process.env, BOT_VIGILANCIA_NOTIFICACIONES: "si" })).toThrow();
  });
});
