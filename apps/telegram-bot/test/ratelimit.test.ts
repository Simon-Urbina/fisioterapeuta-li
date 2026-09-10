import { describe, it, expect } from "vitest";
import { RateLimiter } from "../src/ratelimit.js";

describe("RateLimiter", () => {
  it("permite hasta el máximo y luego bloquea dentro de la ventana", () => {
    const t = 1_000_000;
    const rl = new RateLimiter(3, () => t);
    expect(rl.permitir(1)).toBe(true);
    expect(rl.permitir(1)).toBe(true);
    expect(rl.permitir(1)).toBe(true);
    expect(rl.permitir(1)).toBe(false);
  });

  it("vuelve a permitir cuando la ventana de 60 s pasa", () => {
    let t = 0;
    const rl = new RateLimiter(1, () => t);
    expect(rl.permitir(7)).toBe(true);
    expect(rl.permitir(7)).toBe(false);
    t += 61_000;
    expect(rl.permitir(7)).toBe(true);
  });

  it("los límites son por chat", () => {
    const t = 5;
    const rl = new RateLimiter(1, () => t);
    expect(rl.permitir(1)).toBe(true);
    expect(rl.permitir(2)).toBe(true);
    expect(rl.permitir(1)).toBe(false);
  });

  it("podar elimina chats sin actividad", () => {
    let t = 0;
    const rl = new RateLimiter(5, () => t);
    rl.permitir(1);
    t += 120_000;
    rl.podar();
    // tras podar, el chat 1 arranca de cero
    expect(rl.permitir(1)).toBe(true);
  });
});
