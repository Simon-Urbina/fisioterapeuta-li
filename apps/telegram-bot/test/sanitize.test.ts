import { describe, it, expect } from "vitest";
import { sanearMensaje, LARGO_MAX_MENSAJE } from "../src/sanitize.js";

describe("sanearMensaje", () => {
  it("quita caracteres de control pero conserva saltos de línea y tabs", () => {
    const entrada = `hola${String.fromCharCode(0)}${String.fromCharCode(7)}mundo\nsegunda\tlinea`;
    const { texto } = sanearMensaje(entrada);
    expect(texto).toBe("holamundo\nsegunda\tlinea");
  });

  it("quita el carácter DEL (127)", () => {
    const { texto } = sanearMensaje(`ab${String.fromCharCode(127)}cd`);
    expect(texto).toBe("abcd");
  });

  it("recorta a la longitud máxima e informa el recorte", () => {
    const r = sanearMensaje("a".repeat(LARGO_MAX_MENSAJE + 50));
    expect(r.texto.length).toBe(LARGO_MAX_MENSAJE);
    expect(r.recortado).toBe(true);
  });

  it("normaliza a NFC", () => {
    const descompuesto = `caf${String.fromCharCode(0x65, 0x301)}`; // 'e' + acento combinante
    const { texto } = sanearMensaje(descompuesto);
    expect(texto).toBe("café");
    expect(texto.length).toBe(4);
  });

  it("entrada no string devuelve vacío", () => {
    expect(sanearMensaje(undefined).texto).toBe("");
    expect(sanearMensaje(42).texto).toBe("");
  });
});
