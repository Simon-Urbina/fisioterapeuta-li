import { loadConfig } from "./config.js";
import {
  EntidadesSchema,
  IntencionSchema,
  NOMBRES_ENTIDAD,
  desconocida,
  type Intencion,
} from "./contract/intents.js";
import { ollamaChat, OllamaError } from "./ollama.js";

type ChatFn = typeof ollamaChat;
import { construirSystemPrompt, PREFIJO_USUARIO } from "./prompt.js";
import { sanearMensaje } from "./sanitize.js";
import { cargarConocimiento } from "./conocimiento.js";

export type MotivoFallback =
  | "mensaje_vacio"
  | "json_invalido"
  | "esquema_invalido"
  | "ollama_timeout"
  | "ollama_error";

export interface InterpretarOpts {
  /** Fecha de referencia YYYY-MM-DD (zona de negocio). Por defecto, hoy. */
  hoy?: string;
  /** Inyección del cliente de chat para pruebas. */
  chat?: ChatFn;
}

export interface Interpretacion {
  intencion: Intencion;
  usoFallback: boolean;
  motivoFallback: MotivoFallback | null;
  modelo: string;
  latenciaMs: number;
  recorteEntrada: boolean;
}

function hoyEnZona(tz: string): string {
  // en-CA da formato YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Extrae el primer objeto JSON de un texto que podría traer ruido alrededor. */
function extraerJson(texto: string): unknown {
  const t = texto.trim();
  try {
    return JSON.parse(t);
  } catch {
    const ini = t.indexOf("{");
    const fin = t.lastIndexOf("}");
    if (ini === -1 || fin <= ini) throw new SyntaxError("sin objeto JSON");
    return JSON.parse(t.slice(ini, fin + 1));
  }
}

const NOMBRES_ENTIDAD_SET = new Set<string>(NOMBRES_ENTIDAD);

/**
 * Qué entidades puede REALMENTE pedir cada intención. El modelo chico a veces
 * mete en `faltantes` datos que la intención nunca usa —el caso más molesto es
 * `hora` en `consultar_disponibilidad` (consultar horarios no necesita una
 * hora) o `sede` en `crear_sesion` (el sistema la deduce del día)— y el bot,
 * obediente, se pone a pedirlos por texto. Aquí se recorta `faltantes` a lo que
 * la intención de verdad puede accionar; las que no aparecen (charla,
 * consultar_catalogo/agenda, cancelar_sesion) nunca bloquean por un dato.
 */
const FALTANTES_UTILES: Partial<Record<Intencion["intencion"], ReadonlySet<string>>> = {
  consultar_disponibilidad: new Set(["servicio"]),
  crear_sesion: new Set(["servicio", "fecha", "hora"]),
  modificar_sesion: new Set(["fecha", "hora"]),
  buscar_cliente: new Set(["cliente"]),
  enviar_correo: new Set(["destinatario", "asunto", "texto"]),
  crear_carpeta: new Set(["carpeta"]),
  buscar_archivo: new Set(["consulta"]),
  bloquear_horario: new Set(["fecha", "hora"]),
};

/** Recorta `faltantes` a lo accionable por la intención (ver `FALTANTES_UTILES`). */
function normalizarFaltantes(intn: Intencion): Intencion {
  const utiles = FALTANTES_UTILES[intn.intencion];
  const filtrados = utiles === undefined ? [] : intn.faltantes.filter((f) => utiles.has(f));
  return filtrados.length === intn.faltantes.length ? intn : { ...intn, faltantes: filtrados };
}

/**
 * Limpieza tolerante del objeto crudo del modelo ANTES de validar:
 *  - descarta claves de entidad desconocidas;
 *  - valida CADA entidad contra su forma individual y descarta solo la que
 *    no cumpla (p. ej. hora "3 pm", fecha "viernes") en vez de tumbar toda
 *    la interpretación por una entidad mal formateada — la causa #1 de
 *    "no entendí" evitables. Si el modelo la intentó dar, es que la
 *    intención la necesita: se anota en `faltantes`;
 *  - filtra/deduplica `faltantes` contra la lista blanca (un modelo chico
 *    a veces alucina un nombre que no existe, p. ej. "nombre").
 * Lo que quede se valida con Zod de forma estricta; si no pasa, es fallback.
 */
function prelimpiar(crudo: unknown): unknown {
  if (typeof crudo !== "object" || crudo === null) return crudo;
  const obj = crudo as Record<string, unknown>;
  const esCharla = obj["intencion"] === "charla_general";

  const entidadesRaw = obj["entidades"];
  const entidadesIn =
    typeof entidadesRaw === "object" && entidadesRaw !== null ? entidadesRaw : {};

  // Solo claves de la lista blanca; el acceso es por Reflect.get (clave de un
  // tuple `const`, no un índice dinámico controlable). Cada valor se prueba
  // contra `EntidadesSchema` de a una clave: si no pasa el formato, se cae
  // sola y se apunta como faltante.
  const paresEntidad: [string, unknown][] = [];
  const faltantesPorFormato: string[] = [];
  for (const clave of NOMBRES_ENTIDAD) {
    const bruto: unknown = Reflect.get(entidadesIn, clave);
    if (bruto === undefined || bruto === null) continue;
    const valor: unknown = typeof bruto === "string" ? bruto.normalize("NFC").trim() : bruto;
    if (valor === "") continue;
    if (EntidadesSchema.safeParse({ [clave]: valor }).success) {
      paresEntidad.push([clave, valor]);
    } else if (!esCharla) {
      faltantesPorFormato.push(clave);
    }
  }
  const entidades = Object.fromEntries(paresEntidad);

  const faltantesRaw = obj["faltantes"];
  const faltantesIn = Array.isArray(faltantesRaw) ? faltantesRaw : [];
  const faltantes = [
    ...new Set([
      ...faltantesIn.filter((x): x is string => typeof x === "string" && NOMBRES_ENTIDAD_SET.has(x)),
      ...faltantesPorFormato,
    ]),
  ];

  const respuestaRaw = obj["respuesta"];
  const respuesta = typeof respuestaRaw === "string" ? respuestaRaw.normalize("NFC").trim() : respuestaRaw;

  return {
    intencion: obj["intencion"],
    entidades,
    confianza: obj["confianza"],
    faltantes,
    respuesta,
  };
}

export async function interpretar(
  mensajeCrudo: unknown,
  opts: InterpretarOpts = {},
): Promise<Interpretacion> {
  const cfg = loadConfig();
  const chat = opts.chat ?? ollamaChat;
  const { texto, recortado } = sanearMensaje(mensajeCrudo);

  const base: Omit<Interpretacion, "intencion" | "usoFallback" | "motivoFallback"> = {
    modelo: cfg.OLLAMA_MODEL,
    latenciaMs: 0,
    recorteEntrada: recortado,
  };

  if (texto.length === 0) {
    return {
      ...base,
      intencion: desconocida(),
      usoFallback: true,
      motivoFallback: "mensaje_vacio",
    };
  }

  const hoy = opts.hoy ?? hoyEnZona(cfg.TIMEZONE);
  // Corpus completo: el modelo lo usa solo si clasifica charla_general (ver prompt).
  const contexto = cargarConocimiento();
  const system = construirSystemPrompt(hoy, cfg.TIMEZONE, contexto);

  let contenido: string;
  let modeloReal = cfg.OLLAMA_MODEL;
  let latenciaMs = 0;
  try {
    const r = await chat({
      model: cfg.OLLAMA_MODEL,
      host: cfg.OLLAMA_HOST,
      timeoutMs: cfg.NLU_OLLAMA_TIMEOUT_MS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${PREFIJO_USUARIO}\n${texto}` },
      ],
    });
    contenido = r.content;
    modeloReal = r.model;
    latenciaMs = r.latenciaMs;
  } catch (err) {
    const motivo: MotivoFallback =
      err instanceof OllamaError && err.causa === "timeout"
        ? "ollama_timeout"
        : "ollama_error";
    return {
      ...base,
      intencion: desconocida(),
      usoFallback: true,
      motivoFallback: motivo,
    };
  }

  let crudo: unknown;
  try {
    crudo = extraerJson(contenido);
  } catch {
    return {
      ...base,
      modelo: modeloReal,
      latenciaMs,
      intencion: desconocida(),
      usoFallback: true,
      motivoFallback: "json_invalido",
    };
  }

  const validado = IntencionSchema.safeParse(prelimpiar(crudo));
  if (!validado.success) {
    return {
      ...base,
      modelo: modeloReal,
      latenciaMs,
      intencion: desconocida(),
      usoFallback: true,
      motivoFallback: "esquema_invalido",
    };
  }

  return {
    ...base,
    modelo: modeloReal,
    latenciaMs,
    intencion: normalizarFaltantes(validado.data),
    usoFallback: false,
    motivoFallback: null,
  };
}
