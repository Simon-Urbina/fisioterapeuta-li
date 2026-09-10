import { describe, it, expect } from "vitest";
import { crearDbFalsa } from "./fakeDb.js";
import {
  otorgarDescuentoReferidosSiElegible,
  descuentoDisponible,
  redimirDescuento,
  aplicarPorcentaje,
} from "../src/dominio/referidos.js";

describe("aplicarPorcentaje", () => {
  it("resta el % y redondea a pesos", () => {
    expect(aplicarPorcentaje(100000, 10)).toBe(90000);
    expect(aplicarPorcentaje(120000, 10)).toBe(108000);
    expect(aplicarPorcentaje(90000, 0)).toBe(90000);
  });
});

describe("otorgarDescuentoReferidosSiElegible", () => {
  it("elegible y sin beneficio previo: otorga y devuelve el detalle", async () => {
    const { db, llamadas } = crearDbFalsa([
      [{ aplica: true, efectivos: 5, ya_tiene: false }], // chequeo de elegibilidad
      [{ id: 7 }], // SELECT comercial.otorgar_descuento_referidos(...)
      [{ porcentaje_descuento: "10.00" }], // detalle del beneficio
    ]);
    const r = await otorgarDescuentoReferidosSiElegible(db, 1);
    expect(r).toEqual({ beneficioId: 7, porcentaje: 10, referidos: 5 });
    expect(llamadas[1]?.texto).toContain("otorgar_descuento_referidos");
  });

  it("todavía le faltan referidos: no otorga (una sola consulta)", async () => {
    const { db, llamadas } = crearDbFalsa([[{ aplica: false, efectivos: 3, ya_tiene: false }]]);
    expect(await otorgarDescuentoReferidosSiElegible(db, 1)).toBeNull();
    expect(llamadas).toHaveLength(1);
  });

  it("ya tiene un beneficio de referidos: no otorga otro", async () => {
    const { db, llamadas } = crearDbFalsa([[{ aplica: true, efectivos: 5, ya_tiene: true }]]);
    expect(await otorgarDescuentoReferidosSiElegible(db, 1)).toBeNull();
    expect(llamadas).toHaveLength(1);
  });
});

describe("descuentoDisponible / redimirDescuento", () => {
  it("devuelve el beneficio disponible del paciente", async () => {
    const { db } = crearDbFalsa([[{ id: 9, porcentaje_descuento: "10.00" }]]);
    expect(await descuentoDisponible(db, 1)).toEqual({ beneficioId: 9, porcentaje: 10 });
  });

  it("sin beneficio disponible devuelve null", async () => {
    const { db } = crearDbFalsa([[]]);
    expect(await descuentoDisponible(db, 1)).toBeNull();
  });

  it("redimirDescuento marca el beneficio contra la compra/reserva", async () => {
    const { db, llamadas } = crearDbFalsa([[]]);
    await redimirDescuento(db, { beneficioId: 9, compraId: 50, reservaId: 80 });
    expect(llamadas[0]?.texto).toContain("estado = 'redimido'");
    expect(llamadas[0]?.valores).toEqual([9, 50, 80]);
  });
});
