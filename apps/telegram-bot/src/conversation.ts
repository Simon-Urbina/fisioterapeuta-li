import type { Config } from "./config.js";
import { INTENCIONES_RESTRINGIDAS } from "./auth.js";
import { esSensible } from "./sensitive.js";
import { interpretar, type IntencionNlu, type ResultadoNlu } from "./nluClient.js";
import { sanearMensaje } from "./sanitize.js";

/** Estado conversacional que se guarda por chat mientras faltan datos. */
export interface EstadoConversacion {
  intencion: string | null;
  entidades: Record<string, string | number>;
  faltantes: string[];
  esperandoConfirmacion: boolean;
}

export function estadoInicial(): EstadoConversacion {
  return { intencion: null, entidades: {}, faltantes: [], esperandoConfirmacion: false };
}

function entidadesTexto(e: Record<string, unknown>): Record<string, string | number> {
  const pares = Object.entries(e).filter(
    (par): par is [string, string | number] =>
      (typeof par[1] === "string" && par[1].length > 0) ||
      (typeof par[1] === "number" && Number.isFinite(par[1])),
  );
  return Object.fromEntries(pares);
}

export type Accion =
  | { tipo: "responder"; texto: string }
  | { tipo: "pedir_dato"; texto: string }
  | { tipo: "pedir_confirmacion"; texto: string; intencion: string }
  | { tipo: "ejecutar"; texto: string; intencion: string; entidades: Record<string, string | number> };

export interface Procesado {
  estado: EstadoConversacion;
  accion: Accion;
}

const ETIQUETA_DATO = new Map<string, string>([
  ["cliente", "el nombre del paciente"],
  ["servicio", "el servicio"],
  ["sede", "la sede"],
  ["fecha", "la fecha (YYYY-MM-DD)"],
  ["hora", "la hora (HH:MM)"],
  ["sesion_id", "el número de la cita"],
  ["destinatario", "el destinatario"],
  ["asunto", "el asunto"],
  ["texto", "el contenido"],
  ["carpeta", "el nombre de la carpeta"],
  ["consulta", "qué quieres buscar"],
]);

function resumen(intencion: string, entidades: Record<string, string | number>): string {
  const partes = Object.entries(entidades).map(([k, v]) => `${k}: ${String(v)}`);
  return partes.length > 0 ? `${intencion} — ${partes.join(", ")}` : intencion;
}

function armarDesdeIntencion(intn: IntencionNlu): EstadoConversacion {
  return {
    intencion: intn.intencion,
    entidades: entidadesTexto(intn.entidades),
    faltantes: [...intn.faltantes],
    esperandoConfirmacion: false,
  };
}

function siguientePaso(estado: EstadoConversacion): Procesado {
  const primeroFaltante = estado.faltantes[0];
  if (primeroFaltante !== undefined) {
    const etiqueta = ETIQUETA_DATO.get(primeroFaltante) ?? primeroFaltante;
    return {
      estado,
      accion: { tipo: "pedir_dato", texto: `Para continuar necesito ${etiqueta}.` },
    };
  }
  const intencion = estado.intencion ?? "desconocida";
  if (esSensible(intencion)) {
    return {
      estado: { ...estado, esperandoConfirmacion: true },
      accion: {
        tipo: "pedir_confirmacion",
        intencion,
        texto: `Vas a: ${resumen(intencion, estado.entidades)}.\n¿Confirmas? (sí / no)`,
      },
    };
  }
  return {
    estado: estadoInicial(),
    accion: {
      tipo: "ejecutar",
      intencion,
      entidades: estado.entidades,
      texto: `Ejecutando: ${resumen(intencion, estado.entidades)}\n(pendiente conectar la API núcleo)`,
    },
  };
}

/**
 * Núcleo del manejo de texto libre, sin dependencias de grammY para poder
 * probarlo aislado. `nlu` se inyecta en las pruebas.
 */
export async function procesarTexto(
  cfg: Config,
  estadoPrevio: EstadoConversacion,
  entrada: string,
  nlu: (cfg: Config, mensaje: string) => Promise<ResultadoNlu> = interpretar,
): Promise<Procesado> {
  const { texto } = sanearMensaje(entrada);
  if (texto.length === 0) {
    return { estado: estadoPrevio, accion: { tipo: "responder", texto: "No recibí texto." } };
  }

  // Si veníamos rellenando datos, este mensaje es el valor del primer faltante.
  if (estadoPrevio.intencion !== null && estadoPrevio.faltantes.length > 0) {
    const [slot, ...resto] = estadoPrevio.faltantes;
    const estado: EstadoConversacion = {
      ...estadoPrevio,
      entidades: { ...estadoPrevio.entidades, ...(slot !== undefined ? { [slot]: texto } : {}) },
      faltantes: resto,
    };
    return siguientePaso(estado);
  }

  // Mensaje nuevo: se interpreta con el NLU.
  const r = await nlu(cfg, texto);
  if (!r.ok) {
    return {
      estado: estadoPrevio,
      accion: {
        tipo: "responder",
        texto:
          "No pude interpretar el mensaje ahora mismo. Usá /help para ver los comandos disponibles.",
      },
    };
  }

  const intn = r.intencion;
  if (intn.intencion === "desconocida") {
    return {
      estado: estadoInicial(),
      accion: {
        tipo: "responder",
        texto: "No entendí la solicitud. Probá con /help o reformulá.",
      },
    };
  }

  if (!INTENCIONES_RESTRINGIDAS.has(intn.intencion)) {
    return {
      estado: estadoInicial(),
      accion: { tipo: "responder", texto: "Esa acción no está disponible por este canal." },
    };
  }

  if (intn.confianza < cfg.BOT_CONFIANZA_MINIMA) {
    return {
      estado: estadoInicial(),
      accion: {
        tipo: "responder",
        texto: `Creo que querés "${intn.intencion}" pero no estoy seguro. ¿Podés decirlo de otra forma?`,
      },
    };
  }

  return siguientePaso(armarDesdeIntencion(intn));
}

/** Resolución de la confirmación pendiente. */
export function resolverConfirmacion(
  estado: EstadoConversacion,
  respuesta: "si" | "no",
): Procesado {
  if (!estado.esperandoConfirmacion || estado.intencion === null) {
    return {
      estado: estadoInicial(),
      accion: { tipo: "responder", texto: "No hay nada pendiente de confirmar." },
    };
  }
  if (respuesta === "no") {
    return {
      estado: estadoInicial(),
      accion: { tipo: "responder", texto: "Cancelado. No se hizo ningún cambio." },
    };
  }
  return {
    estado: estadoInicial(),
    accion: {
      tipo: "ejecutar",
      intencion: estado.intencion,
      entidades: estado.entidades,
      texto: `Confirmado: ${resumen(estado.intencion, estado.entidades)}\n(pendiente conectar la API núcleo)`,
    },
  };
}
