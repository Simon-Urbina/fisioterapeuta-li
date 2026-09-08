import type { Db } from "../db.js";

/**
 * Búsqueda de pacientes por nombre escrito a mano (con errores de
 * digitación y sin tildes) usando `personas.v_paciente` y el índice trigram
 * que ya define `db/migrations/schema.sql` sobre nombres + apellidos.
 */

export interface Paciente {
  id: number;
  nombreCompleto: string;
  telefono: string | null;
  email: string | null;
}

export type ResultadoBusquedaPaciente =
  | { tipo: "unico"; paciente: Paciente }
  | { tipo: "ambiguo"; candidatos: Paciente[] }
  | { tipo: "no_encontrado" };

export type ResultadoIdentidadChat =
  | { tipo: "conocido"; paciente: Paciente }
  | { tipo: "desconocido" };

export type ResultadoVinculoPorDocumento =
  | { tipo: "vinculado"; paciente: { id: number; nombreEnmascarado: string } }
  | { tipo: "no_encontrado" }
  | { tipo: "ambiguo" }
  | { tipo: "datos_no_coinciden" }
  | { tipo: "bloqueado" };

interface FilaPaciente {
  id: number | string;
  nombre_completo: string;
  telefono: string | null;
  email: string | null;
}

export async function buscarPaciente(db: Db, nombre: string): Promise<ResultadoBusquedaPaciente> {
  const r = await db.query<FilaPaciente>(
    `SELECT id, nombre_completo, telefono, email
       FROM personas.v_paciente
      WHERE activo
        AND sin_tildes(lower(nombre_completo)) % sin_tildes(lower($1))
      ORDER BY similarity(sin_tildes(lower(nombre_completo)), sin_tildes(lower($1))) DESC
      LIMIT 5`,
    [nombre],
  );

  const candidatos: Paciente[] = r.rows.map((f) => ({
    id: Number(f.id),
    nombreCompleto: f.nombre_completo,
    telefono: f.telefono,
    email: f.email ?? null,
  }));

  const [primero] = candidatos;
  if (primero === undefined) return { tipo: "no_encontrado" };
  if (candidatos.length === 1) return { tipo: "unico", paciente: primero };
  return { tipo: "ambiguo", candidatos };
}

/**
 * Identidad por canal: `personas.vinculo_telegram` vincula un chat_id de
 * Telegram con un paciente (schema.sql: "un chat sin paciente vinculado es
 * un desconocido: puede consultar el catálogo pero no ver ni agendar nada a
 * nombre de otro"). Esto es lo que permite reconocer a un paciente que
 * vuelve a escribir sin pedirle sus datos de nuevo.
 */
export async function resolverPorChatId(db: Db, chatId: number): Promise<ResultadoIdentidadChat> {
  const r = await db.query<FilaPaciente>(
    `SELECT p.id, p.nombres || ' ' || p.apellidos AS nombre_completo, p.telefono, p.email
       FROM personas.vinculo_telegram v
       JOIN personas.paciente p ON p.id = v.paciente_id
      WHERE v.chat_id = $1 AND NOT v.bloqueado AND p.activo`,
    [chatId],
  );
  const fila = r.rows[0];
  if (fila === undefined) return { tipo: "desconocido" };
  return {
    tipo: "conocido",
    paciente: {
      id: Number(fila.id),
      nombreCompleto: fila.nombre_completo,
      telefono: fila.telefono,
      email: fila.email ?? null,
    },
  };
}

/**
 * ¿Este paciente ya ASISTIÓ a una valoración inicial? No basta con haberla
 * reservado o pagado: la regla del consultorio es que solo después de la
 * consulta de valoración se habilitan los demás servicios. Una inasistencia
 * (`no_asistio`) cuenta como realizada, igual que en la política de cancelación.
 */
export async function tieneValoracionAtendida(db: Db, pacienteId: number): Promise<boolean> {
  const r = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (
        SELECT 1
          FROM agenda.reserva r
          JOIN agenda.reserva_participante rp ON rp.reserva_id = r.id
          JOIN catalogo.servicio s ON s.id = r.servicio_id
         WHERE rp.paciente_id = $1
           AND r.tipo = 'cita'
           AND s.codigo = 'VALORACION'
           AND r.estado IN ('atendida', 'no_asistio')
     ) AS existe`,
    [pacienteId],
  );
  return r.rows[0]?.existe === true;
}

/**
 * ¿Este paciente YA tiene una valoración inicial "viva" (agendada y sin
 * atender)? Una sola a la vez: si ya reservó una que sigue en pie
 * (propuesta / pendiente de pago / confirmada / en curso), no puede sacar
 * otra hasta asistir o cancelar la que tiene. Las canceladas/expiradas/
 * rechazadas NO cuentan — puede volver a reservar tras una de esas.
 */
export async function tieneValoracionActiva(db: Db, pacienteId: number): Promise<boolean> {
  const r = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (
        SELECT 1
          FROM agenda.reserva r
          JOIN agenda.reserva_participante rp ON rp.reserva_id = r.id
          JOIN catalogo.servicio s ON s.id = r.servicio_id
         WHERE rp.paciente_id = $1
           AND r.tipo = 'cita'
           AND s.codigo = 'VALORACION'
           AND r.estado IN ('propuesta', 'pendiente_pago', 'confirmada', 'en_curso')
     ) AS existe`,
    [pacienteId],
  );
  return r.rows[0]?.existe === true;
}

/** "Laura Gómez Díaz" -> "Laura G." — para confirmarle al chat a quién vinculó sin exponer el nombre completo. */
function enmascararNombre(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/).filter((p) => p.length > 0);
  const nombre = partes[0] ?? nombreCompleto.trim();
  const inicialApellido = partes[1]?.[0];
  return inicialApellido !== undefined ? `${nombre} ${inicialApellido.toUpperCase()}.` : nombre;
}

/**
 * Identificación de un chat de Telegram que NO llegó por el bot (p. ej. un
 * paciente que reservó por el sitio web y nunca creó el vínculo). Se le pide
 * su número de documento y los últimos 4 dígitos del teléfono que tiene
 * registrado; si ambos casan con un único paciente activo, se crea (o
 * actualiza) `personas.vinculo_telegram` para ese chat. Verificación ligera
 * a propósito (no OTP): suficiente para el MVP, y el candado real de "solo
 * veo/cancelo lo mío" sigue siendo el chequeo de propiedad en cada operación.
 */
export async function vincularChatPorDocumento(
  db: Db,
  opts: { chatId: number; documento: string; ultimos4: string },
): Promise<ResultadoVinculoPorDocumento> {
  const doc = opts.documento.trim();
  const r = await db.query<{ id: number | string; nombre_completo: string; telefono: string | null }>(
    `SELECT id, nombres || ' ' || apellidos AS nombre_completo, telefono
       FROM personas.paciente
      WHERE numero_documento = $1 AND activo
      LIMIT 2`,
    [doc],
  );
  const fila = r.rows[0];
  if (fila === undefined) return { tipo: "no_encontrado" };
  if (r.rows.length > 1) return { tipo: "ambiguo" };

  const telefonoDigitos = (fila.telefono ?? "").replace(/\D/g, "");
  if (telefonoDigitos.length < 4 || telefonoDigitos.slice(-4) !== opts.ultimos4.trim()) {
    return { tipo: "datos_no_coinciden" };
  }

  const pacienteId = Number(fila.id);

  // Un vínculo marcado como bloqueado (abuso, etc.) no se reactiva por esta vía.
  const previo = await db.query<{ bloqueado: boolean }>(
    `SELECT bloqueado FROM personas.vinculo_telegram WHERE chat_id = $1`,
    [opts.chatId],
  );
  if (previo.rows[0]?.bloqueado === true) return { tipo: "bloqueado" };

  await db.query(
    `INSERT INTO personas.vinculo_telegram (chat_id, paciente_id, verificado_en)
     VALUES ($1, $2, now())
     ON CONFLICT (chat_id)
     DO UPDATE SET paciente_id = EXCLUDED.paciente_id, verificado_en = now()`,
    [opts.chatId, pacienteId],
  );

  return {
    tipo: "vinculado",
    paciente: { id: pacienteId, nombreEnmascarado: enmascararNombre(fila.nombre_completo) },
  };
}

/**
 * Primera cita: crea el paciente (o reutiliza uno existente con el mismo
 * documento — mismo criterio que el sitio web, ver web/publico.ts) y su
 * vínculo con el chat, en una sola transacción para no dejar un chat "a
 * medio registrar" si algo falla. `nombreCompleto` se parte en
 * nombres/apellidos por el primer espacio; sin segundo token, apellidos
 * repite nombres (mejor que dejarlo vacío para el MVP — Lina puede
 * completar la ficha después). El tipo de documento se asume cédula de
 * ciudadanía (CC): pedir el tipo por chat es fricción que no vale la pena
 * para el caso ampliamente dominante.
 */
/** "no", "ninguno", "nadie", "n/a", "-", "" -> el paciente dice que nadie lo refirió. */
const RE_SIN_REFERIDO = /^(no|ninguno?|nadie|n\/?a|na|-{1,2}|)$/i;

/** Código de referido del paciente (`personas.paciente.codigo_referido`), para poder compartirlo por correo. */
export async function codigoReferidoDe(db: Db, pacienteId: number): Promise<string | null> {
  const r = await db.query<{ codigo_referido: string | null }>(
    `SELECT codigo_referido FROM personas.paciente WHERE id = $1`,
    [pacienteId],
  );
  return r.rows[0]?.codigo_referido ?? null;
}

export async function crearPacienteConVinculo(
  db: Db,
  opts: {
    nombreCompleto: string;
    telefono: string;
    email?: string | null;
    documento: string;
    eps?: string | null;
    /** Código de referido de quien lo invitó (o "no"). Si no matchea a nadie, se ignora en silencio. */
    referido?: string | null;
    chatId: number;
  },
): Promise<Paciente & { codigoReferido: string | null }> {
  return db.tx(async (tx) => {
    const existente = await tx.query<{
      id: number | string;
      nombre_completo: string;
      telefono: string | null;
      email: string | null;
      codigo_referido: string | null;
    }>(
      `SELECT id, nombres || ' ' || apellidos AS nombre_completo, telefono, email, codigo_referido
         FROM personas.paciente
        WHERE numero_documento = $1 AND activo
        LIMIT 1`,
      [opts.documento.trim()],
    );

    let pacienteId: number;
    let nombreCompleto: string;
    let telefono: string | null;
    let email: string | null;
    let codigoReferido: string | null;

    if (existente.rows[0]) {
      pacienteId = Number(existente.rows[0].id);
      nombreCompleto = existente.rows[0].nombre_completo;
      telefono = existente.rows[0].telefono;
      email = existente.rows[0].email;
      codigoReferido = existente.rows[0].codigo_referido;
    } else {
      const partes = opts.nombreCompleto.trim().split(/\s+/);
      const nombres = partes[0] ?? opts.nombreCompleto;
      const apellidos = partes.slice(1).join(" ") || nombres;

      // Código de quien lo invitó: si no matchea a nadie se ignora en silencio
      // (un typo en un campo opcional no debe tumbar la reserva). Mismo criterio
      // que web/publico.ts.
      const codigoRef = (opts.referido ?? "").trim();
      let referenteId: number | null = null;
      if (codigoRef.length > 0 && !RE_SIN_REFERIDO.test(codigoRef)) {
        const ref = await tx.query<{ id: number | string }>(
          `SELECT id FROM personas.paciente WHERE codigo_referido = $1 AND activo LIMIT 1`,
          [codigoRef.toUpperCase()],
        );
        referenteId = ref.rows[0] ? Number(ref.rows[0].id) : null;
      }

      const r = await tx.query<{ id: number; codigo_referido: string }>(
        `INSERT INTO personas.paciente
           (nombres, apellidos, telefono, email, numero_documento, eps_otro, tipo_documento_id, referido_por_paciente_id)
         VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM catalogo.tipo_documento WHERE codigo = 'CC'), $7)
         RETURNING id, codigo_referido`,
        [nombres, apellidos, opts.telefono, opts.email ?? null, opts.documento.trim(), opts.eps ?? null, referenteId],
      );
      const fila = r.rows[0] as { id: number; codigo_referido: string };
      pacienteId = fila.id;
      codigoReferido = fila.codigo_referido;
      nombreCompleto = `${nombres} ${apellidos}`.trim();
      telefono = opts.telefono;
      email = opts.email ?? null;
    }

    await tx.query(
      `INSERT INTO personas.vinculo_telegram (chat_id, paciente_id, verificado_en)
       VALUES ($1, $2, now())`,
      [opts.chatId, pacienteId],
    );

    return { id: pacienteId, nombreCompleto, telefono, email, codigoReferido };
  });
}
