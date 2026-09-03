import { describe, it, expect } from "vitest";
import { crearDbFalsa, crearDbFalsaConError } from "./fakeDb.js";
import { ejecutarComando } from "../src/comandos.js";

describe("ejecutarComando", () => {
  it("intención con datos faltantes no toca la base y devuelve 422", async () => {
    const { db, llamadas } = crearDbFalsa();
    const r = await ejecutarComando(db, "crear_sesion", { cliente: "Laura" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ codigo: "datos_incompletos", status: 422 });
    expect(llamadas).toHaveLength(0);
  });

  it("consultar_agenda sin filtros consulta agenda.v_cita", async () => {
    const { db } = crearDbFalsa([
      [
        {
          reserva_id: 1,
          reserva_uuid: "u1",
          estado: "confirmada",
          inicia_en: "2026-09-05T15:00:00-05:00",
          termina_en: "2026-09-05T15:40:00-05:00",
          sede_nombre: "Tunja",
          servicio_nombre: "Punción Seca",
          paciente_nombre: "Laura Gómez",
        },
      ],
    ]);
    const r = await ejecutarComando(db, "consultar_agenda", {});
    expect(r.ok).toBe(true);
    expect(r.datos).toMatchObject({ citas: [{ reservaId: 1, sede: "Tunja" }] });
  });

  it("consultar_disponibilidad resuelve servicio y sede antes de pedir los slots", async () => {
    const { db, llamadas } = crearDbFalsa([
      [{ id: 3, nombre: "Punción Seca", duracion_min_minutos: 30, duracion_max_minutos: 45 }],
      [{ id: 1, nombre: "Tunja" }],
      [{ slot_inicio: "2026-09-05T15:00:00-05:00", slot_fin: "2026-09-05T15:40:00-05:00" }],
    ]);
    const r = await ejecutarComando(db, "consultar_disponibilidad", {
      servicio: "punción",
      sede: "tunja",
      fecha: "2026-09-05",
    });
    expect(r.ok).toBe(true);
    expect(llamadas).toHaveLength(3);
  });

  it("consultar_disponibilidad con servicio inexistente devuelve 404 sin seguir a la sede", async () => {
    const { db, llamadas } = crearDbFalsa([[]]);
    const r = await ejecutarComando(db, "consultar_disponibilidad", {
      servicio: "no existe",
      sede: "tunja",
      fecha: "2026-09-05",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ codigo: "no_encontrado", status: 404 });
    expect(llamadas).toHaveLength(1);
  });

  it("crear_sesion feliz: resuelve cliente, servicio y sede, y crea la reserva", async () => {
    const { db, llamadas } = crearDbFalsa([
      [{ id: 5, nombre_completo: "Laura Gómez", telefono: null }],
      [{ id: 3, nombre: "Punción Seca", duracion_min_minutos: 30, duracion_max_minutos: 45 }],
      [{ id: 1, nombre: "Tunja" }],
      [{ crear_reserva: 77 }],
    ]);
    const r = await ejecutarComando(
      db,
      "crear_sesion",
      { cliente: "Laura", servicio: "Punción", sede: "Tunja", fecha: "2026-09-05", hora: "15:00" },
      { creadoPor: "bot-telegram" },
    );
    expect(r).toEqual({ ok: true, datos: { reservaId: 77 } });
    expect(llamadas).toHaveLength(4);
  });

  it("crear_sesion con cliente ambiguo devuelve 409 y los candidatos", async () => {
    const { db, llamadas } = crearDbFalsa([
      [
        { id: 1, nombre_completo: "Laura Gómez", telefono: null },
        { id: 2, nombre_completo: "Laura Pérez", telefono: null },
      ],
    ]);
    const r = await ejecutarComando(db, "crear_sesion", {
      cliente: "Laura",
      servicio: "Punción",
      sede: "Tunja",
      fecha: "2026-09-05",
      hora: "15:00",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ codigo: "cliente_ambiguo", status: 409 });
    expect((r.datos as { candidatos: unknown[] }).candidatos).toHaveLength(2);
    expect(llamadas).toHaveLength(1); // no llegó a resolver servicio/sede
  });

  it("crear_sesion propaga un conflicto de doble reserva de Postgres como 409", async () => {
    const { db } = crearDbFalsaConError(
      [
        [{ id: 5, nombre_completo: "Laura Gómez", telefono: null }],
        [{ id: 3, nombre: "Punción Seca", duracion_min_minutos: 30, duracion_max_minutos: 45 }],
        [{ id: 1, nombre: "Tunja" }],
      ],
      3,
      { code: "23505", message: "El horario ya fue tomado." },
    );
    const r = await ejecutarComando(db, "crear_sesion", {
      cliente: "Laura",
      servicio: "Punción",
      sede: "Tunja",
      fecha: "2026-09-05",
      hora: "15:00",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ codigo: "conflicto", status: 409 });
  });

  it("cancelar_sesion delega en agenda.cancelar_reserva", async () => {
    const { db } = crearDbFalsa([[{ estado: "cancelada_a_tiempo" }]]);
    const r = await ejecutarComando(db, "cancelar_sesion", { sesion_id: 9 });
    expect(r).toEqual({ ok: true, datos: { estado: "cancelada_a_tiempo" } });
  });

  it("buscar_cliente devuelve la lista de candidatos aunque esté vacía", async () => {
    const { db } = crearDbFalsa([[]]);
    const r = await ejecutarComando(db, "buscar_cliente", { cliente: "nadie" });
    expect(r).toEqual({ ok: true, datos: { candidatos: [] } });
  });

  it("enviar_correo inserta en el outbox, nunca llama a Gmail directamente", async () => {
    const { db, llamadas } = crearDbFalsa([[{ id: 12 }]]);
    const r = await ejecutarComando(db, "enviar_correo", {
      destinatario: "paciente@correo.com",
      asunto: "Recordatorio",
      texto: "Tu cita es mañana.",
    });
    expect(r).toEqual({ ok: true, datos: { outboxId: 12 } });
    expect(llamadas[0]?.texto).toContain("integracion.outbox");
  });

  it("buscar_archivo devuelve 501 sin tocar la base: falta el adaptador de Google", async () => {
    const { db, llamadas } = crearDbFalsa();
    const r = await ejecutarComando(db, "buscar_archivo", { consulta: "consentimiento Laura" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ codigo: "no_implementado", status: 501 });
    expect(llamadas).toHaveLength(0);
  });

  it("bloquear_horario resuelve la sede y crea la reserva tipo bloqueo", async () => {
    const { db, llamadas } = crearDbFalsa([
      [{ id: 1, nombre: "Tunja" }],
      [{ id: 2 }], // profesional por defecto
      [{ id: 55 }], // insert
    ]);
    const r = await ejecutarComando(db, "bloquear_horario", {
      sede: "Tunja",
      fecha: "2026-12-24",
      hora: "00:00",
      texto: "Festivo",
    });
    expect(r).toEqual({ ok: true, datos: { reservaId: 55 } });
    expect(llamadas).toHaveLength(3);
  });
});
