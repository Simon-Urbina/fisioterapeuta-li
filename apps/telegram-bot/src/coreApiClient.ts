import { z } from "zod";
import type { Config } from "./config.js";

/**
 * Cliente directo a core-api SOLO para las operaciones de pago (reportar
 * comprobante y verificación por el staff). No son intenciones del modelo,
 * por eso no pasan por n8n. Auth: la misma X-Internal-Key.
 */

const PagoPendiente = z.object({
  pagoId: z.number(),
  valor: z.number(),
  referencia: z.string().nullable(),
  comprobanteRef: z.string().nullable(),
  reportadoEn: z.string(),
  reservaId: z.number(),
  iniciaEn: z.string(),
  servicio: z.string().nullable(),
  sede: z.string().nullable(),
  paciente: z.string(),
});
export type PagoPendiente = z.infer<typeof PagoPendiente>;

const ReservaConfirmada = z.object({
  reservaId: z.number(),
  servicio: z.string().nullable(),
  iniciaEn: z.string(),
  chatId: z.string().nullable(),
});
export type ReservaConfirmada = z.infer<typeof ReservaConfirmada>;

const CitaPorAsistir = z.object({
  reservaId: z.number(),
  iniciaEn: z.string(),
  servicio: z.string().nullable(),
  sede: z.string().nullable(),
  paciente: z.string(),
});
export type CitaPorAsistir = z.infer<typeof CitaPorAsistir>;

const AsistenciaRegistrada = z.object({
  reservaId: z.number(),
  estado: z.string(),
  servicio: z.string().nullable(),
  iniciaEn: z.string(),
  chatId: z.string().nullable(),
});
export type AsistenciaRegistrada = z.infer<typeof AsistenciaRegistrada>;

const RecordatorioPendiente = z.object({
  reservaId: z.number(),
  pacienteId: z.number(),
  paciente: z.string(),
  servicio: z.string().nullable(),
  sede: z.string().nullable(),
  iniciaEn: z.string(),
  chatId: z.string().nullable(),
  pacienteEmail: z.string().nullable(),
});
export type RecordatorioPendiente = z.infer<typeof RecordatorioPendiente>;

const CitaHoy = z.object({
  reservaId: z.number(),
  pacienteId: z.number().nullable(),
  estado: z.string(),
  iniciaEn: z.string(),
  terminaEn: z.string(),
  servicio: z.string().nullable(),
  sede: z.string(),
  paciente: z.string().nullable(),
  telefono: z.string().nullable(),
  canal: z.string(),
});
export type CitaHoy = z.infer<typeof CitaHoy>;

const AntecedenteResumen = z.object({
  nombre: z.string(),
  detalle: z.string().nullable(),
  esBanderaRoja: z.boolean(),
});

const AnamnesisResumen = z.object({
  motivoConsulta: z.string().nullable(),
  enfermedadActual: z.string().nullable(),
  inicioSintomas: z.string().nullable(),
  objetivosTerapeuticos: z.string().nullable(),
  registradoEn: z.string(),
});

const VitalesResumen = z.object({
  sistolica: z.number().nullable(),
  diastolica: z.number().nullable(),
  frecuenciaCardiaca: z.number().nullable(),
  saturacionO2: z.number().nullable(),
  imc: z.number().nullable(),
  requiereAtencion: z.boolean(),
  tomadoEn: z.string(),
});

const DolorResumen = z.object({
  intensidad: z.number(),
  clasificacion: z.string(),
  localizacion: z.string().nullable(),
  zona: z.string().nullable(),
  evaluadoEn: z.string(),
});

const EvolucionResumen = z.object({
  subjetivo: z.string().nullable(),
  objetivo: z.string().nullable(),
  analisis: z.string().nullable(),
  plan: z.string().nullable(),
  registradoEn: z.string(),
});

const CitaResumen = z.object({
  estado: z.string(),
  iniciaEn: z.string(),
  servicio: z.string().nullable(),
  sede: z.string(),
});

const HistoriaResumen = z.object({
  pacienteId: z.number(),
  nombreCompleto: z.string(),
  telefono: z.string().nullable(),
  email: z.string().nullable(),
  antecedentes: z.array(AntecedenteResumen),
  anamnesisUltima: AnamnesisResumen.nullable(),
  vitalesUltima: VitalesResumen.nullable(),
  dolorUltima: DolorResumen.nullable(),
  evolucionesRecientes: z.array(EvolucionResumen),
  citasRecientes: z.array(CitaResumen),
});
export type HistoriaResumen = z.infer<typeof HistoriaResumen>;

const ResultadoHistoriaResumen = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("no_encontrado") }),
  z.object({ tipo: z.literal("ambiguo"), candidatos: z.array(z.object({ id: z.number(), nombreCompleto: z.string() })) }),
  z.object({ tipo: z.literal("encontrado"), resumen: HistoriaResumen }),
]);
export type ResultadoHistoriaResumen = z.infer<typeof ResultadoHistoriaResumen>;

const AvisoTelegramSimple = z.object({
  id: z.number(),
  chatId: z.string(),
  texto: z.string(),
});
export type AvisoTelegramSimple = z.infer<typeof AvisoTelegramSimple>;

const ConfirmacionTgPendiente = z.object({
  reservaId: z.number(),
  pacienteId: z.number(),
  paciente: z.string(),
  servicio: z.string().nullable(),
  sede: z.string().nullable(),
  iniciaEn: z.string(),
  chatId: z.string(),
});
export type ConfirmacionTgPendiente = z.infer<typeof ConfirmacionTgPendiente>;

const ResultadoVinculo = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("vinculado"),
    paciente: z.object({ id: z.number(), nombreEnmascarado: z.string() }),
  }),
  z.object({ tipo: z.literal("no_encontrado") }),
  z.object({ tipo: z.literal("ambiguo") }),
  z.object({ tipo: z.literal("datos_no_coinciden") }),
  z.object({ tipo: z.literal("bloqueado") }),
]);
export type ResultadoVinculo = z.infer<typeof ResultadoVinculo>;

const RespuestaOk = z.object({ ok: z.literal(true), datos: z.unknown() });

export type ResultadoCoreApi<T> = { ok: true; datos: T } | { ok: false; motivo: "red" | "http" | "respuesta_invalida" };

async function pedir(cfg: Config, ruta: string, cuerpo?: unknown): Promise<ResultadoCoreApi<unknown>> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.INTERNAL_API_KEY !== undefined) headers["x-internal-key"] = cfg.INTERNAL_API_KEY;
  let resp: Response;
  try {
    resp = await fetch(new URL(ruta, cfg.CORE_API_URL), {
      method: cuerpo === undefined ? "GET" : "POST",
      headers,
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
      signal: AbortSignal.timeout(cfg.BOT_CORE_API_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, motivo: "red" };
  }
  const json: unknown = await resp.json().catch(() => null);
  if (!resp.ok) return { ok: false, motivo: "http" };
  const parsed = RespuestaOk.safeParse(json);
  if (!parsed.success) return { ok: false, motivo: "respuesta_invalida" };
  return { ok: true, datos: parsed.data.datos };
}

export interface ClienteCoreApi {
  registrarPago(
    cfg: Config,
    p: { compraId: number; valor: number; referencia?: string | null; comprobanteRef?: string | null; creadoPor: string },
  ): Promise<ResultadoCoreApi<{ pagoId: number }>>;
  pagosPendientes(cfg: Config): Promise<ResultadoCoreApi<{ pagos: PagoPendiente[] }>>;
  verificarPago(
    cfg: Config,
    p: { pagoId: number; por: string },
  ): Promise<ResultadoCoreApi<{ reservasConfirmadas: ReservaConfirmada[] }>>;
  rechazarPago(
    cfg: Config,
    p: { pagoId: number; por: string; motivo?: string },
  ): Promise<ResultadoCoreApi<{ reservaId: number | null; servicio: string | null; iniciaEn: string | null; chatId: string | null }>>;
  citasPorAsistir(cfg: Config): Promise<ResultadoCoreApi<{ citas: CitaPorAsistir[] }>>;
  registrarAsistencia(
    cfg: Config,
    p: { reservaId: number; asistio: boolean; por: string },
  ): Promise<ResultadoCoreApi<AsistenciaRegistrada>>;
  recordatoriosReclamar(cfg: Config): Promise<ResultadoCoreApi<{ recordatorios: RecordatorioPendiente[] }>>;
  recordatorioMarcarEnviado(
    cfg: Config,
    p: { reservaId: number; pacienteId: number; ok: boolean; error?: string | null },
  ): Promise<ResultadoCoreApi<{ ok: true }>>;
  recordatorioEnviarEmail(
    cfg: Config,
    p: { reservaId: number; pacienteId: number },
  ): Promise<ResultadoCoreApi<{ enviado: boolean }>>;
  citasHoy(cfg: Config): Promise<ResultadoCoreApi<{ citas: CitaHoy[] }>>;
  historiaResumen(cfg: Config, documento: string): Promise<ResultadoCoreApi<ResultadoHistoriaResumen>>;
  /**
   * Vincula un chat de Telegram con un paciente ya existente (p. ej. uno que
   * reservó por la web) verificando documento + últimos 4 dígitos del
   * teléfono. Es una operación interna (no una intención del modelo).
   */
  vincularPorDocumento(
    cfg: Config,
    p: { chatId: number; documento: string; ultimos4: string },
  ): Promise<ResultadoCoreApi<ResultadoVinculo>>;
  /** Avisos "cita confirmada" por Telegram pendientes (confirmadas desde el panel web). */
  confirmacionesTelegramPendientes(
    cfg: Config,
  ): Promise<ResultadoCoreApi<{ confirmaciones: ConfirmacionTgPendiente[] }>>;
  marcarConfirmacionTelegram(
    cfg: Config,
    p: { reservaId: number; pacienteId: number; ok: boolean; error?: string | null },
  ): Promise<ResultadoCoreApi<{ ok: true }>>;
  /** Avisos "simples" por Telegram con el cuerpo ya redactado (p. ej. la felicitación por referidos). */
  avisosTelegramPendientes(cfg: Config): Promise<ResultadoCoreApi<{ avisos: AvisoTelegramSimple[] }>>;
  marcarAvisoTelegram(
    cfg: Config,
    p: { id: number; ok: boolean; error?: string | null },
  ): Promise<ResultadoCoreApi<{ ok: true }>>;
}

export const coreApi: ClienteCoreApi = {
  async registrarPago(cfg, p) {
    const r = await pedir(cfg, "/pagos", {
      compra_id: p.compraId,
      valor: p.valor,
      referencia: p.referencia ?? null,
      comprobante_ref: p.comprobanteRef ?? null,
      creado_por: p.creadoPor,
    });
    if (!r.ok) return r;
    const d = z.object({ pagoId: z.number() }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async pagosPendientes(cfg) {
    const r = await pedir(cfg, "/pagos/pendientes");
    if (!r.ok) return r;
    const d = z.object({ pagos: z.array(PagoPendiente) }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async verificarPago(cfg, p) {
    const r = await pedir(cfg, "/pagos/verificar", { pago_id: p.pagoId, por: p.por });
    if (!r.ok) return r;
    const d = z.object({ reservasConfirmadas: z.array(ReservaConfirmada) }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async rechazarPago(cfg, p) {
    const r = await pedir(cfg, "/pagos/rechazar", { pago_id: p.pagoId, por: p.por, motivo: p.motivo ?? null });
    if (!r.ok) return r;
    const d = z
      .object({
        reservaId: z.number().nullable(),
        servicio: z.string().nullable(),
        iniciaEn: z.string().nullable(),
        chatId: z.string().nullable(),
      })
      .safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async citasPorAsistir(cfg) {
    const r = await pedir(cfg, "/citas/por-asistir");
    if (!r.ok) return r;
    const d = z.object({ citas: z.array(CitaPorAsistir) }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async registrarAsistencia(cfg, p) {
    const r = await pedir(cfg, "/asistencia", { reserva_id: p.reservaId, asistio: p.asistio, por: p.por });
    if (!r.ok) return r;
    const d = AsistenciaRegistrada.safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async recordatoriosReclamar(cfg) {
    const r = await pedir(cfg, "/recordatorios/reclamar", {});
    if (!r.ok) return r;
    const d = z.object({ recordatorios: z.array(RecordatorioPendiente) }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async recordatorioMarcarEnviado(cfg, p) {
    const r = await pedir(cfg, "/recordatorios/marcar-enviado", {
      reserva_id: p.reservaId,
      paciente_id: p.pacienteId,
      ok: p.ok,
      error: p.error ?? null,
    });
    if (!r.ok) return r;
    return { ok: true, datos: { ok: true } };
  },
  async recordatorioEnviarEmail(cfg, p) {
    const r = await pedir(cfg, "/recordatorios/enviar-email", { reserva_id: p.reservaId, paciente_id: p.pacienteId });
    if (!r.ok) return r;
    const d = z.object({ enviado: z.boolean() }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async citasHoy(cfg) {
    const r = await pedir(cfg, "/citas/hoy");
    if (!r.ok) return r;
    const d = z.object({ citas: z.array(CitaHoy) }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async historiaResumen(cfg, documento) {
    const r = await pedir(cfg, `/historia?documento=${encodeURIComponent(documento)}`);
    if (!r.ok) return r;
    const d = ResultadoHistoriaResumen.safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async vincularPorDocumento(cfg, p) {
    const r = await pedir(cfg, "/vinculo-telegram", {
      chat_id: p.chatId,
      documento: p.documento,
      ultimos4: p.ultimos4,
    });
    if (!r.ok) return r;
    const d = ResultadoVinculo.safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async confirmacionesTelegramPendientes(cfg) {
    const r = await pedir(cfg, "/confirmaciones-telegram/pendientes");
    if (!r.ok) return r;
    const d = z.object({ confirmaciones: z.array(ConfirmacionTgPendiente) }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async marcarConfirmacionTelegram(cfg, p) {
    const r = await pedir(cfg, "/confirmaciones-telegram/marcar", {
      reserva_id: p.reservaId,
      paciente_id: p.pacienteId,
      ok: p.ok,
      error: p.error ?? null,
    });
    if (!r.ok) return r;
    return { ok: true, datos: { ok: true } };
  },
  async avisosTelegramPendientes(cfg) {
    const r = await pedir(cfg, "/avisos-telegram/pendientes");
    if (!r.ok) return r;
    const d = z.object({ avisos: z.array(AvisoTelegramSimple) }).safeParse(r.datos);
    return d.success ? { ok: true, datos: d.data } : { ok: false, motivo: "respuesta_invalida" };
  },
  async marcarAvisoTelegram(cfg, p) {
    const r = await pedir(cfg, "/avisos-telegram/marcar", { id: p.id, ok: p.ok, error: p.error ?? null });
    if (!r.ok) return r;
    return { ok: true, datos: { ok: true } };
  },
};
