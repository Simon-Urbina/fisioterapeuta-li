import { describe, it, expect } from "vitest";
import { construirCorreo } from "../src/dominio/correo.js";

describe("construirCorreo", () => {
  it("texto plano: mantiene el estilo de bloques y agrega el pie por defecto", () => {
    const { texto } = construirCorreo({
      titulo: "Su cita quedó confirmada",
      parrafos: ["Su cita de Punción Seca quedó confirmada. Recibimos su pago."],
      datos: [
        { etiqueta: "Cuándo", valor: "lunes, 8 de septiembre, 15:00" },
        { etiqueta: "Dónde", valor: "Tunja" },
      ],
      nota: "Venga con ropa cómoda.",
      cierre: "La esperamos.",
    });

    expect(texto).toContain("Su cita de Punción Seca quedó confirmada. Recibimos su pago.");
    expect(texto).toContain("Cuándo: lunes, 8 de septiembre, 15:00\nDónde: Tunja");
    expect(texto).toContain("Venga con ropa cómoda.");
    expect(texto).toContain("La esperamos.");
    expect(texto).toContain("escríbanos al 311 398 1422");
    expect(texto.trimEnd().endsWith("La Fisioterapeuta Li")).toBe(true);
    // El título es solo del HTML, no se repite en el texto plano.
    expect(texto).not.toContain("Su cita quedó confirmada\n");
  });

  it("incluirPie: false deja el cuerpo tal cual, sin firma ni línea de reprogramación", () => {
    const { texto } = construirCorreo({
      titulo: "Aviso",
      parrafos: ["Primer párrafo.", "Segundo párrafo."],
      incluirPie: false,
    });
    expect(texto).toBe("Primer párrafo.\n\nSegundo párrafo.");
    expect(texto).not.toContain("311 398 1422");
    expect(texto).not.toContain("La Fisioterapeuta Li");
  });

  it("html: tabla con la identidad de marca y el mismo contenido", () => {
    const { html } = construirCorreo({
      titulo: "Recordatorio: Valoración inicial mañana",
      parrafos: ["Le recordamos su cita de Valoración inicial mañana."],
      datos: [{ etiqueta: "Cuándo", valor: "martes, 15:00" }],
    });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<table");
    expect(html).toContain("#0b4272"); // azul de marca
    expect(html).toContain("La Fisioterapeuta Li");
    expect(html).toContain("Recordatorio: Valoración inicial mañana");
    expect(html).toContain("Le recordamos su cita de Valoración inicial mañana.");
    expect(html).toContain("tel:+573113981422");
  });

  it("html: escapa el contenido para que no se pueda inyectar marcado", () => {
    const { html, texto } = construirCorreo({
      titulo: "Prueba <b>",
      parrafos: ['Hola <script>alert("x")</script> & cía.'],
      incluirPie: false,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; cía.");
    // El texto plano no se toca.
    expect(texto).toContain('<script>alert("x")</script>');
  });
});
