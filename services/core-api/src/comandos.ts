import type { Db } from "./db.js";
import { ErrorDominio, normalizarErrorDb } from "./errores.js";
import type { Entidades, IntencionEjecutable } from "./contract/comando.js";
import * as agenda from "./dominio/agenda.js";
import * as pacientes from "./dominio/pacientes.js";
import * as catalogo from "./dominio/catalogo.js";
import * as integraciones from "./dominio/integraciones.js";

/**
 * Punto de entrada único para ejecutar una intención ya interpretada y (si
 * era sensible) confirmada por la persona. Corresponde a `POST /comandos`
 * en el README: "n8n envía la intención aquí; el modelo nunca".
 *
 * No confía en que el llamador ya validó los datos: vuelve a comprobar los
 * campos obligatorios por intención (`REQUISITOS`) antes de tocar la base,
 * igual que `apps/telegram-bot/src/conversation.ts` lo hace del lado del
 * bot. Defensa en profundidad, no duplicación accidental.
 */

const REQUISITOS: Record<IntencionEjecutable, readonly (keyof Entidades)[]> = {
  consultar_agenda: [],
  consultar_disponibilidad: ["servicio", "sede", "fecha"],
  crear_sesion: ["cliente", "servicio", "sede", "fecha", "hora"],
  modificar_sesion: ["sesion_id", "fecha", "hora"],
  cancelar_sesion: ["sesion_id"],
  buscar_cliente: ["cliente"],
  enviar_correo: ["destinatario", "asunto", "texto"],
  crear_carpeta: ["carpeta"],
  buscar_archivo: ["consulta"],
  bloquear_horario: ["sede", "fecha", "hora"],
};

function camposFaltantes(intencion: IntencionEjecutable, entidades: Entidades): string[] {
  const requeridos = REQUISITOS[intencion];
  return requeridos.filter((campo) => entidades[campo] === undefined || entidades[campo] === null);
}

/**
 * Saca un valor de `entidades` ya sabiendo (por `camposFaltantes`) que no
 * debería faltar. Si de todos modos falta, lanza en vez de asumir: así el
 * dominio nunca recibe `null`/`undefined` sin pasar por un `as`/`!` que
 * apague el chequeo de tipos.
 */
function exigir<T>(valor: T | null | undefined, campo: string): T {
  if (valor === null || valor === undefined) {
    throw new ErrorDominio(`Falta el dato requerido: ${campo}.`, "datos_incompletos", 422);
  }
  return valor;
}

/** Combina fecha (YYYY-MM-DD) y hora (HH:MM) en un timestamp con el offset fijo de Bogotá (UTC-05:00, sin horario de verano). */
function aTimestamptzBogota(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00-05:00`;
}

function sieteDiasDespuesIso(desdeIso: string): string {
  const fecha = new Date(desdeIso);
  fecha.setUTCDate(fecha.getUTCDate() + 7);
  return fecha.toISOString();
}

export interface ErrorComando {
  codigo: string;
  mensaje: string;
  status: number;
}

export interface ResultadoComando {
  ok: boolean;
  datos?: unknown;
  error?: ErrorComando;
}

function errorComando(codigo: string, mensaje: string, status: number): ResultadoComando {
  return { ok: false, error: { codigo, mensaje, status } };
}

export async function ejecutarComando(
  db: Db,
  intencion: IntencionEjecutable,
  entidades: Entidades,
  ctx: { creadoPor?: string | null } = {},
): Promise<ResultadoComando> {
  const faltan = camposFaltantes(intencion, entidades);
  if (faltan.length > 0) {
    return errorComando(
      "datos_incompletos",
      `Faltan datos para "${intencion}": ${faltan.join(", ")}.`,
      422,
    );
  }

  try {
    switch (intencion) {
      case "consultar_agenda": {
        const desdeIso = entidades.fecha ? `${entidades.fecha}T00:00:00-05:00` : new Date().toISOString();
        const hastaIso = entidades.fecha
          ? `${entidades.fecha}T23:59:59-05:00`
          : sieteDiasDespuesIso(desdeIso);
        const citas = await agenda.consultarAgenda(db, {
          desdeIso,
          hastaIso,
          sedeNombre: entidades.sede ?? null,
        });
        return { ok: true, datos: { citas } };
      }

      case "consultar_disponibilidad": {
        const nombreServicio = exigir(entidades.servicio, "servicio");
        const nombreSede = exigir(entidades.sede, "sede");
        const fecha = exigir(entidades.fecha, "fecha");

        const servicio = await catalogo.resolverServicio(db, nombreServicio);
        if (!servicio) return errorComando("no_encontrado", "No se encontró ese servicio.", 404);
        const sede = await catalogo.resolverSede(db, nombreSede);
        if (!sede) return errorComando("no_encontrado", "No se encontró esa sede.", 404);

        const slots = await agenda.consultarDisponibilidad(db, {
          servicioId: servicio.id,
          sedeId: sede.id,
          fecha,
        });
        return { ok: true, datos: { servicio: servicio.nombre, sede: sede.nombre, slots } };
      }

      case "crear_sesion": {
        const nombreCliente = exigir(entidades.cliente, "cliente");
        const nombreServicio = exigir(entidades.servicio, "servicio");
        const nombreSede = exigir(entidades.sede, "sede");
        const fecha = exigir(entidades.fecha, "fecha");
        const hora = exigir(entidades.hora, "hora");

        const resultadoPaciente = await pacientes.buscarPaciente(db, nombreCliente);
        if (resultadoPaciente.tipo === "no_encontrado") {
          return errorComando("no_encontrado", "No se encontró ningún paciente con ese nombre.", 404);
        }
        if (resultadoPaciente.tipo === "ambiguo") {
          return {
            ok: false,
            datos: { candidatos: resultadoPaciente.candidatos },
            error: {
              codigo: "cliente_ambiguo",
              mensaje: "Hay más de un paciente con ese nombre; hace falta precisar cuál.",
              status: 409,
            },
          };
        }
        const servicio = await catalogo.resolverServicio(db, nombreServicio);
        if (!servicio) return errorComando("no_encontrado", "No se encontró ese servicio.", 404);
        const sede = await catalogo.resolverSede(db, nombreSede);
        if (!sede) return errorComando("no_encontrado", "No se encontró esa sede.", 404);

        const creada = await agenda.crearSesion(db, {
          pacienteId: resultadoPaciente.paciente.id,
          servicioId: servicio.id,
          sedeId: sede.id,
          iniciaEnIso: aTimestamptzBogota(fecha, hora),
          creadoPor: ctx.creadoPor ?? null,
        });
        return { ok: true, datos: creada };
      }

      case "modificar_sesion": {
        const sesionId = exigir(entidades.sesion_id, "sesion_id");
        const fecha = exigir(entidades.fecha, "fecha");
        const hora = exigir(entidades.hora, "hora");

        const resultado = await agenda.modificarSesion(db, {
          reservaId: sesionId,
          nuevaIniciaEnIso: aTimestamptzBogota(fecha, hora),
          motivo: "Reprogramada desde el bot",
          por: ctx.creadoPor ?? null,
        });
        return { ok: true, datos: resultado };
      }

      case "cancelar_sesion": {
        const sesionId = exigir(entidades.sesion_id, "sesion_id");
        const resultado = await agenda.cancelarSesion(db, {
          reservaId: sesionId,
          motivo: entidades.texto ?? "Cancelada desde el bot",
          por: ctx.creadoPor ?? null,
        });
        return { ok: true, datos: resultado };
      }

      case "buscar_cliente": {
        const nombreCliente = exigir(entidades.cliente, "cliente");
        const resultado = await pacientes.buscarPaciente(db, nombreCliente);
        const candidatos =
          resultado.tipo === "unico"
            ? [resultado.paciente]
            : resultado.tipo === "ambiguo"
              ? resultado.candidatos
              : [];
        return { ok: true, datos: { candidatos } };
      }

      case "enviar_correo": {
        const resultado = await integraciones.enviarCorreo(db, {
          destinatario: exigir(entidades.destinatario, "destinatario"),
          asunto: exigir(entidades.asunto, "asunto"),
          texto: exigir(entidades.texto, "texto"),
        });
        return { ok: true, datos: resultado };
      }

      case "crear_carpeta": {
        const resultado = await integraciones.crearCarpeta(db, {
          carpeta: exigir(entidades.carpeta, "carpeta"),
        });
        return { ok: true, datos: resultado };
      }

      case "buscar_archivo":
        integraciones.buscarArchivo();
        break; // inalcanzable: buscarArchivo() siempre lanza

      case "bloquear_horario": {
        const nombreSede = exigir(entidades.sede, "sede");
        const fecha = exigir(entidades.fecha, "fecha");
        const hora = exigir(entidades.hora, "hora");

        const sede = await catalogo.resolverSede(db, nombreSede);
        if (!sede) return errorComando("no_encontrado", "No se encontró esa sede.", 404);
        const resultado = await agenda.bloquearHorario(db, {
          sedeId: sede.id,
          iniciaEnIso: aTimestamptzBogota(fecha, hora),
          duracionMinutos: 60,
          motivo: entidades.texto ?? "Bloqueado desde el bot",
          creadoPor: ctx.creadoPor ?? null,
        });
        return { ok: true, datos: resultado };
      }
    }
    // No debería alcanzarse: el switch cubre todo IntencionEjecutable.
    return errorComando("intencion_no_soportada", `Sin manejador para "${intencion}".`, 500);
  } catch (err) {
    const errorDominio = err instanceof ErrorDominio ? err : normalizarErrorDb(err);
    return errorComando(errorDominio.codigo, errorDominio.message, errorDominio.status);
  }
}
