import { describe, it, expect } from "vitest";
import { crearDbFalsa } from "./fakeDb.js";
import { buscarPaciente } from "../src/dominio/pacientes.js";

describe("dominio/pacientes", () => {
  it("un solo resultado → tipo unico", async () => {
    const { db } = crearDbFalsa([[{ id: 1, nombre_completo: "Laura Gómez", telefono: "3001234567" }]]);
    const r = await buscarPaciente(db, "laura");
    expect(r).toEqual({
      tipo: "unico",
      paciente: { id: 1, nombreCompleto: "Laura Gómez", telefono: "3001234567" },
    });
  });

  it("varios resultados → tipo ambiguo con todos los candidatos", async () => {
    const { db } = crearDbFalsa([
      [
        { id: 1, nombre_completo: "Laura Gómez", telefono: null },
        { id: 2, nombre_completo: "Laura Pérez", telefono: null },
      ],
    ]);
    const r = await buscarPaciente(db, "laura");
    expect(r.tipo).toBe("ambiguo");
    if (r.tipo === "ambiguo") {
      expect(r.candidatos).toHaveLength(2);
    }
  });

  it("sin resultados → tipo no_encontrado", async () => {
    const { db } = crearDbFalsa([[]]);
    const r = await buscarPaciente(db, "nadie-existe");
    expect(r).toEqual({ tipo: "no_encontrado" });
  });
});
