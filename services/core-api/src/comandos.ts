import type { Db } from "./db.js";
import { ErrorDominio, normalizarErrorDb } from "./errores.js";
import type { Entidades, IntencionEjecutable } from "./contract/comando.js";
import * as agenda from "./dominio/agenda.js";
import * as pacientes from "./dominio/pacientes.js";
import * as catalogo from "./dominio/catalogo.js";
import * as integraciones from "./dominio/integraciones.js";
import { construirCorreo } from "./dominio/correo.js";

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
  consultar_catalogo: [],
  consultar_agenda: [],
  // sin fecha: el bot pide los "próximos horarios" (varios días); con fecha: ese día.
  consultar_disponibilidad: ["servicio"],
  // "cliente" no está aquí a propósito: para un chat de Telegram identificado
  // se resuelve solo (ver el case); solo hace falta si el paciente es
  // desconocido o el canal no tiene identidad de chat (ver más abajo).
  crear_sesion: ["servicio", "sede", "fecha", "hora"],
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
 * Sede según el día de la semana, por la regla del consultorio (doc de Lina):
 * Tunja de lunes a viernes, Turmequé sábados y domingos. El paciente no elige
 * sede — se deriva de la fecha cuando el canal no la mandó explícita.
 */
function sedePorFecha(fecha: string): string | null {
  const d = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const dia = d.getUTCDay(); // 0 = domingo … 6 = sábado
  return dia === 0 || dia === 6 ? "Turmequé" : "Tunja";
}

/** El paciente nuevo solo puede reservar esto; el resto exige haber tenido ya una. */
const RE_VALORACION_INICIAL = /valoraci[oó]n\s+inicial/i;

/** Etiqueta en español para los campos que el usuario podría tener que aportar. */
const ETIQUETA_CAMPO = new Map<string, string>([
  ["servicio", "el servicio"],
  ["sede", "la sede"],
  ["fecha", "la fecha"],
  ["hora", "la hora"],
  ["sesion_id", "el número de la cita"],
  ["cliente", "el nombre del paciente"],
  ["destinatario", "el destinatario"],
  ["asunto", "el asunto"],
  ["texto", "el contenido"],
  ["carpeta", "el nombre de la carpeta"],
  ["consulta", "qué buscar"],
]);

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

/** Fecha de hoy (AAAA-MM-DD) en la zona de Bogotá. */
function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function sieteDiasDespuesIso(desdeIso: string): string {
  const fecha = new Date(desdeIso);
  fecha.setUTCDate(fecha.getUTCDate() + 7);
  return fecha.toISOString();
}

function unAñoDespuesIso(desdeIso: string): string {
  const fecha = new Date(desdeIso);
  fecha.setUTCFullYear(fecha.getUTCFullYear() + 1);
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
  // `esAdmin` lo decide server.ts contra cfg.adminChatIds, nunca el propio
  // llamador: así este módulo no depende de Config y sigue siendo trivial
  // de probar. `creadoPor` es el chat_id de Telegram como string cuando el
  // canal lo tiene; en otros canales (web, pruebas) puede no serlo — por
  // eso siempre se valida con Number.isSafeInteger antes de usarlo como tal.
  ctx: { creadoPor?: string | null; esAdmin?: boolean } = {},
): Promise<ResultadoComando> {
  // El paciente no elige sede: la define el día (Tunja L-V, Turmequé S-D).
  // Solo se deriva si el canal no la mandó explícita.
  if (
    (intencion === "crear_sesion" || intencion === "consultar_disponibilidad") &&
    (entidades.sede === undefined || entidades.sede === null) &&
    typeof entidades.fecha === "string"
  ) {
    const sede = sedePorFecha(entidades.fecha);
    if (sede !== null) entidades = { ...entidades, sede };
  }

  const faltan = camposFaltantes(intencion, entidades);
  if (faltan.length > 0) {
    return {
      ok: false,
      datos: { camposFaltantes: faltan },
      error: {
        codigo: "datos_incompletos",
        mensaje: `Me falta un dato para continuar: ${faltan.map((c) => ETIQUETA_CAMPO.get(c) ?? c).join(", ")}.`,
        status: 422,
      },
    };
  }

  try {
    switch (intencion) {
      case "consultar_catalogo": {
        const servicios = await catalogo.listarServicios(db);
        // Señales para el bot (la lista SIEMPRE va completa: es información):
        //  - `registrado`: el chat ya está vinculado a un paciente.
        //  - `valoracionRealizada`: además ya asistió a su valoración inicial.
        //    Hasta que eso pase, el bot solo ofrece la valoración inicial.
        //  - `valoracionActiva`: ya tiene una valoración inicial agendada y sin
        //    atender — no puede sacar otra (una sola a la vez).
        const chatId = Number(ctx.creadoPor);
        let registrado = true;
        let valoracionRealizada = true;
        let valoracionActiva = false;
        if (ctx.esAdmin !== true && Number.isSafeInteger(chatId)) {
          const identidad = await pacientes.resolverPorChatId(db, chatId);
          if (identidad.tipo === "conocido") {
            registrado = true;
            valoracionRealizada = await pacientes.tieneValoracionAtendida(db, identidad.paciente.id);
            valoracionActiva =
              !valoracionRealizada && (await pacientes.tieneValoracionActiva(db, identidad.paciente.id));
          } else {
            registrado = false;
            valoracionRealizada = false;
          }
        }
        return { ok: true, datos: { servicios, registrado, valoracionRealizada, valoracionActiva } };
      }

      case "consultar_agenda": {
        const chatId = Number(ctx.creadoPor);
        const esAdminOAnonimo = ctx.esAdmin === true || !Number.isSafeInteger(chatId);

        const desdeIso = entidades.fecha ? `${entidades.fecha}T00:00:00-05:00` : new Date().toISOString();
        // Con fecha: ese día. Sin fecha: para admin, la semana ("qué hay esta
        // semana"); para el paciente, TODAS sus citas próximas ("mis citas"),
        // no solo las de 7 días.
        const hastaIso = entidades.fecha
          ? `${entidades.fecha}T23:59:59-05:00`
          : esAdminOAnonimo
            ? sieteDiasDespuesIso(desdeIso)
            : unAñoDespuesIso(desdeIso);

        // Admin (Lina/staff): agenda completa. Cualquier otro chat ve solo la
        // suya, resuelta por personas.vinculo_telegram. Un canal sin chat_id
        // numérico (web, pruebas) se trata como admin: no hay identidad que filtrar.
        if (esAdminOAnonimo) {
          const citas = await agenda.consultarAgenda(db, {
            desdeIso,
            hastaIso,
            sedeNombre: entidades.sede ?? null,
          });
          return { ok: true, datos: { citas } };
        }
        // `vinculado`: señal para el bot igual que `registrado` en
        // consultar_catalogo. Si es false, el chat todavía no está atado a un
        // paciente (p. ej. reservó por la web): el bot le ofrece identificarse
        // con cédula + teléfono en vez de decir "no tiene citas".
        const identidad = await pacientes.resolverPorChatId(db, chatId);
        if (identidad.tipo === "desconocido") {
          return { ok: true, datos: { citas: [], vinculado: false } };
        }
        const citas = await agenda.consultarAgenda(db, {
          desdeIso,
          hastaIso,
          sedeNombre: entidades.sede ?? null,
          pacienteId: identidad.paciente.id,
        });
        return { ok: true, datos: { citas, vinculado: true } };
      }

      case "consultar_disponibilidad": {
        const nombreServicio = exigir(entidades.servicio, "servicio");
        const servicio = await catalogo.resolverServicio(db, nombreServicio);
        if (!servicio) return errorComando("no_encontrado", "No se encontró ese servicio.", 404);

        // Sin fecha: las N próximas disponibles en orden (no todo el calendario).
        if (entidades.fecha === undefined || entidades.fecha === null) {
          const tunja = await catalogo.resolverSede(db, "Tunja");
          const turmeque = await catalogo.resolverSede(db, "Turmequé");
          if (!tunja || !turmeque) return errorComando("no_encontrado", "No se encontraron las sedes.", 404);
          const slots = await agenda.proximosSlots(db, {
            servicioId: servicio.id,
            desdeFecha: hoyBogota(),
            limite: 6,
            horizonteDias: 21,
            sedes: { tunja: tunja.id, turmeque: turmeque.id },
          });
          return { ok: true, datos: { servicio: servicio.nombre, modo: "proximos", slots } };
        }

        // Con fecha: ese día. La sede ya vino derivada de la fecha (ver la
        // normalización al inicio de ejecutarComando).
        const fecha = entidades.fecha;
        const sede = await catalogo.resolverSede(db, exigir(entidades.sede, "sede"));
        if (!sede) return errorComando("no_encontrado", "No se encontró esa sede.", 404);
        const todos = await agenda.consultarDisponibilidad(db, {
          servicioId: servicio.id,
          sedeId: sede.id,
          fecha,
        });
        // Se descarta lo que caiga a menos de 24 h (no se puede reservar igual).
        const limite24h = Date.now() + 24 * 60 * 60 * 1000;
        const slots = todos.filter((s) => new Date(s.inicio).getTime() >= limite24h);
        return { ok: true, datos: { servicio: servicio.nombre, sede: sede.nombre, modo: "dia", slots } };
      }

      case "crear_sesion": {
        const nombreServicio = exigir(entidades.servicio, "servicio");
        const nombreSede = exigir(entidades.sede, "sede");
        const fecha = exigir(entidades.fecha, "fecha");
        const hora = exigir(entidades.hora, "hora");

        const servicio = await catalogo.resolverServicio(db, nombreServicio);
        if (!servicio) return errorComando("no_encontrado", "No se encontró ese servicio.", 404);

        const iniciaEnIso = aTimestamptzBogota(fecha, hora);
        const horasDeAnticipacion = (new Date(iniciaEnIso).getTime() - Date.now()) / 3_600_000;
        if (horasDeAnticipacion < 24) {
          return errorComando(
            "anticipacion_insuficiente",
            "Las citas se reservan con al menos 24 horas de anticipación. Para algo más pronto, escríbanos al 311 398 1422.",
            422,
          );
        }

        const tarifa = await catalogo.resolverTarifaIndividual(db, servicio.id);
        if (!tarifa) {
          return errorComando("no_encontrado", "Ese servicio no tiene una tarifa configurada.", 404);
        }

        // Un chat de Telegram no-admin se identifica solo (o se registra si
        // es su primera cita). Admin y canales sin chat_id numérico (web,
        // pruebas) siguen el camino de siempre: nombre libre + búsqueda
        // difusa, porque ahí "cliente" es a nombre de otra persona.
        const chatId = Number(ctx.creadoPor);
        const identificaPorChat = ctx.esAdmin !== true && Number.isSafeInteger(chatId);

        let paciente: pacientes.Paciente;
        if (identificaPorChat) {
          const identidad = await pacientes.resolverPorChatId(db, chatId);
          if (identidad.tipo === "conocido") {
            paciente = identidad.paciente;
            // Ya es paciente, pero si todavía no asistió a su valoración
            // inicial solo puede reservar esa consulta, nada más.
            if (
              !RE_VALORACION_INICIAL.test(servicio.nombre) &&
              !(await pacientes.tieneValoracionAtendida(db, paciente.id))
            ) {
              return errorComando(
                "valoracion_requerida",
                "Su valoración inicial todavía no se ha realizado. Cuando asista a esa consulta podrá reservar los demás servicios.",
                422,
              );
            }
          } else {
            // Chat sin paciente vinculado = primera cita: solo la valoración inicial.
            if (!RE_VALORACION_INICIAL.test(servicio.nombre)) {
              return errorComando(
                "valoracion_requerida",
                "Para su primera cita agendamos una Valoración inicial. Después de esa consulta podrá reservar los demás servicios.",
                422,
              );
            }
            // `referido` es opcional pero se PREGUNTA (el paciente responde el
            // código o "no"); por eso entra en la lista de campos requeridos.
            const faltanRegistro = (
              ["cliente", "telefono", "email", "documento", "eps", "referido"] as const
            ).filter((campo) => entidades[campo] === undefined || entidades[campo] === null);
            if (faltanRegistro.length > 0) {
              return {
                ok: false,
                datos: { camposFaltantes: faltanRegistro },
                error: {
                  codigo: "registro_requerido",
                  mensaje:
                    "Es su primera cita: necesito su nombre completo, su teléfono, su correo (le enviamos ahí la confirmación), su número de documento, su EPS y, si alguien lo refirió, su código de referido.",
                  status: 422,
                },
              };
            }
            paciente = await pacientes.crearPacienteConVinculo(db, {
              nombreCompleto: exigir(entidades.cliente, "cliente"),
              telefono: exigir(entidades.telefono, "telefono"),
              email: exigir(entidades.email, "email"),
              documento: exigir(entidades.documento, "documento"),
              eps: exigir(entidades.eps, "eps"),
              referido: entidades.referido ?? null,
              chatId,
            });
          }
        } else {
          const nombreCliente = exigir(entidades.cliente, "cliente");
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
          paciente = resultadoPaciente.paciente;
        }

        // Una sola valoración inicial "viva" por paciente: si ya tiene una
        // agendada y sin atender, no puede sacar otra (evita que el mismo chat
        // acumule valoraciones). Solo aplica al auto-agendamiento por chat; el
        // staff puede tener un motivo para reagendar a mano.
        if (
          identificaPorChat &&
          RE_VALORACION_INICIAL.test(servicio.nombre) &&
          (await pacientes.tieneValoracionActiva(db, paciente.id))
        ) {
          return errorComando(
            "valoracion_ya_agendada",
            "Ya tiene una valoración inicial agendada. Cuando asista a esa consulta se habilitan los demás servicios; para verla, cambiarla o cancelarla escríbame «mis citas».",
            409,
          );
        }

        const sede = await catalogo.resolverSede(db, nombreSede);
        if (!sede) return errorComando("no_encontrado", "No se encontró esa sede.", 404);

        const creada = await agenda.crearSesion(db, {
          pacienteId: paciente.id,
          servicioId: servicio.id,
          sedeId: sede.id,
          iniciaEnIso,
          creadoPor: ctx.creadoPor ?? null,
          tarifa,
        });

        // Acuse por correo (la confirmación real va cuando se verifica el
        // pago — ver dominio/pagos.ts). Solo si el paciente dejó email.
        if (paciente.email) {
          const codigoRef = await pacientes.codigoReferidoDe(db, paciente.id);
          const { texto, html } = construirCorreo({
            titulo: "Recibimos su reserva",
            saludo: `Hola ${paciente.nombreCompleto},`,
            parrafos: [
              `Recibimos su reserva de ${servicio.nombre} en ${sede.nombre}.`,
              "Está pendiente del pago anticipado; le confirmamos la cita apenas lo verifiquemos.",
              ...(codigoRef
                ? [
                    `Su código de referido es ${codigoRef}. Compártalo: cuando alguien venga a su cita y lo mencione, usted suma para un descuento.`,
                  ]
                : []),
            ],
            datos: [{ etiqueta: "Cuándo", valor: `${fecha} a las ${hora}` }],
          });
          await integraciones.enviarCorreo(db, {
            destinatario: paciente.email,
            asunto: "Recibimos su reserva — La Fisioterapeuta Li",
            texto,
            html,
          });
        }

        // `pacienteId` solo va en la respuesta cuando quien reservó es el
        // propio paciente por chat (no cuando Lina/admin reserva a nombre de
        // otro): es lo que el bot usa para decidir si tiene sentido
        // ofrecerle A ESE CHAT sincronizar con SU Calendar personal.
        return {
          ok: true,
          datos: identificaPorChat ? { ...creada, pacienteId: paciente.id } : creada,
        };
      }

      case "modificar_sesion": {
        const sesionId = exigir(entidades.sesion_id, "sesion_id");
        const fecha = exigir(entidades.fecha, "fecha");
        const hora = exigir(entidades.hora, "hora");

        // Un chat de paciente solo puede reprogramar SUS citas.
        const chatId = Number(ctx.creadoPor);
        if (ctx.esAdmin !== true && Number.isSafeInteger(chatId)) {
          const identidad = await pacientes.resolverPorChatId(db, chatId);
          const suya =
            identidad.tipo === "conocido" &&
            (await agenda.reservaEsDelPaciente(db, sesionId, identidad.paciente.id));
          if (!suya) return errorComando("no_autorizado", "Esa cita no está a su nombre.", 403);
        }

        const nuevaIso = aTimestamptzBogota(fecha, hora);
        if ((new Date(nuevaIso).getTime() - Date.now()) / 3_600_000 < 24) {
          return errorComando(
            "anticipacion_insuficiente",
            "El nuevo horario debe ser con al menos 24 horas de anticipación.",
            422,
          );
        }

        const resultado = await agenda.modificarSesion(db, {
          reservaId: sesionId,
          nuevaIniciaEnIso: nuevaIso,
          por: ctx.creadoPor ?? null,
        });
        return { ok: true, datos: resultado };
      }

      case "cancelar_sesion": {
        const sesionId = exigir(entidades.sesion_id, "sesion_id");

        // Un chat de paciente solo puede cancelar SUS citas. Admin y canales
        // sin chat_id numérico (web, pruebas) cancelan cualquiera.
        const chatId = Number(ctx.creadoPor);
        if (ctx.esAdmin !== true && Number.isSafeInteger(chatId)) {
          const identidad = await pacientes.resolverPorChatId(db, chatId);
          const suya =
            identidad.tipo === "conocido" &&
            (await agenda.reservaEsDelPaciente(db, sesionId, identidad.paciente.id));
          if (!suya) {
            return errorComando("no_autorizado", "Esa cita no está a su nombre.", 403);
          }
        }

        const resultado = await agenda.cancelarSesion(db, {
          reservaId: sesionId,
          motivo: entidades.texto ?? "Cancelada por el paciente desde el bot",
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
        const asunto = exigir(entidades.asunto, "asunto");
        const cuerpo = exigir(entidades.texto, "texto");
        // El cuerpo ya viene redactado (lo dicta Lina): solo se le pone la
        // identidad visual, sin agregar firma ni línea de reprogramación.
        const { texto, html } = construirCorreo({
          titulo: asunto,
          parrafos: cuerpo.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0),
          incluirPie: false,
        });
        const resultado = await integraciones.enviarCorreo(db, {
          destinatario: exigir(entidades.destinatario, "destinatario"),
          asunto,
          texto,
          html,
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
