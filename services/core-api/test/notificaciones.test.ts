import { describe, it, expect } from "vitest";
import { crearDbFalsa } from "./fakeDb.js";
import {
  reclamarRecordatorios24h,
  listarConfirmacionesTelegramPendientes,
  componerDigestDiario,
  type CitaDigest,
} from "../src/dominio/notificaciones.js";

describe("mensajeTelegram compuesto en core-api (no en el canal)", () => {
  it("reclamarRecordatorios24h arma el cuerpo del recordatorio", async () => {
    const { db } = crearDbFalsa([
      [
        {
          reserva_id: 42,
          paciente_id: 7,
          paciente: "María Gómez",
          servicio: "Punción seca",
          sede: "Tunja",
          inicia_en: "2026-09-10T20:00:00-05:00",
          chat_id: "123456",
          paciente_email: "maria@example.com",
        },
      ],
    ]);

    const [rec] = await reclamarRecordatorios24h(db);

    expect(rec?.mensajeTelegram).toContain("Hola, María 👋");
    expect(rec?.mensajeTelegram).toContain("Le recordamos su cita de Punción seca mañana.");
    expect(rec?.mensajeTelegram).toContain("Dónde: Tunja");
    // indicación específica de punción (ver indicacionesPara)
    expect(rec?.mensajeTelegram).toContain("puntualidad estricta");
    expect(rec?.mensajeTelegram).toContain("311 398 1422");
  });

  it("listarConfirmacionesTelegramPendientes arma el cuerpo del aviso de confirmación", async () => {
    const { db } = crearDbFalsa([
      [
        {
          reserva_id: 9,
          paciente_id: 3,
          paciente: "Juan Pérez",
          servicio: "Valoración inicial",
          sede: "Turmequé",
          inicia_en: "2026-09-11T09:30:00-05:00",
          chat_id: "999",
        },
      ],
    ]);

    const [c] = await listarConfirmacionesTelegramPendientes(db);

    expect(c?.mensajeTelegram).toContain("¡Su cita quedó confirmada! ✅");
    expect(c?.mensajeTelegram).toContain("Valoración inicial · 09:30");
    expect(c?.mensajeTelegram).toContain("Turmequé");
    expect(c?.mensajeTelegram).toContain("¡Le esperamos! 💛");
  });
});

describe("componerDigestDiario", () => {
  const dia = "2026-09-11T12:00:00-05:00";

  it("lista las citas del día ordenadas por hora y omite las canceladas/expiradas", () => {
    const citas: CitaDigest[] = [
      { estado: "confirmada", iniciaEn: "2026-09-11T15:00:00-05:00", servicio: "Descarga muscular", sede: "Tunja", paciente: "Ana Ruiz" },
      { estado: "confirmada", iniciaEn: "2026-09-11T08:00:00-05:00", servicio: "Valoración inicial", sede: "Tunja", paciente: "Juan Pérez" },
      { estado: "cancelada_a_tiempo", iniciaEn: "2026-09-11T10:00:00-05:00", servicio: "Punción seca", sede: "Tunja", paciente: "Nadie" },
      { estado: "expirada", iniciaEn: "2026-09-11T11:00:00-05:00", servicio: "X", sede: "Tunja", paciente: "Tampoco" },
    ];

    const txt = componerDigestDiario(dia, citas);

    expect(txt).toContain("🗓️ Agenda de hoy —");
    expect(txt).toContain("2 citas:");
    expect(txt).not.toContain("Nadie");
    expect(txt).not.toContain("Tampoco");
    // orden: 08:00 antes que 15:00
    expect(txt.indexOf("08:00")).toBeLessThan(txt.indexOf("15:00"));
    expect(txt).toContain("• 08:00 · Valoración inicial · Juan Pérez · Tunja");
  });

  it("sin citas vivas dice que no hay nada agendado", () => {
    const txt = componerDigestDiario(dia, [
      { estado: "rechazada", iniciaEn: "2026-09-11T09:00:00-05:00", servicio: "X", sede: "Tunja", paciente: "Y" },
    ]);
    expect(txt).toContain("Hoy no tiene citas agendadas.");
  });

  it("una sola cita usa 'cita' en singular", () => {
    const txt = componerDigestDiario(dia, [
      { estado: "pendiente_pago", iniciaEn: "2026-09-11T09:00:00-05:00", servicio: "Punción seca", sede: "Turmequé", paciente: "Sara" },
    ]);
    expect(txt).toContain("1 cita:");
  });
});
