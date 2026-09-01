// Datos de ejemplo. Reemplazar por los que entregue el equipo de backend/n8n.

// Catálogo real de servicios (documento entregado por la clienta).

export type OpcionPrecio = {
  label: string;
  precio: number; // COP
  porSesion?: number; // COP por sesión, si aplica a un paquete
};

export type ServicioCatalogo = {
  slug: string;
  nombre: string;
  duracion: string; // texto para mostrar, ej. "1 hora"
  duracionMin: number; // minutos, para la lógica de agenda
  descripcion: string;
  opciones: OpcionPrecio[];
  reservableIndividualmente: boolean; // false = planes grupales/convenios, se gestionan por contacto directo
  notaPromo?: string;
};

export type CategoriaServicio = {
  id: string;
  nombre: string;
  descripcion?: string;
  servicios: ServicioCatalogo[];
};

export const catalogo: CategoriaServicio[] = [
  {
    id: "valoracion-rehabilitacion",
    nombre: "Valoración inicial y rehabilitación física",
    servicios: [
      {
        slug: "valoracion-inicial",
        nombre: "Valoración inicial",
        duracion: "Sesión de valoración",
        duracionMin: 45,
        descripcion:
          "Evaluación completa del estado físico para diseñar tu plan de tratamiento.",
        opciones: [{ label: "Valoración inicial", precio: 100000 }],
        reservableIndividualmente: true,
        notaPromo: "Gratis al adquirir un paquete de terapias de rehabilitación",
      },
      {
        slug: "rehabilitacion-fisica",
        nombre: "Rehabilitación / terapia física",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion:
          "Sesión de rehabilitación y terapia física individual.",
        opciones: [
          { label: "Sesión individual", precio: 100000 },
          { label: "Paquete de 5 sesiones", precio: 460000, porSesion: 92000 },
          { label: "Paquete de 10 sesiones", precio: 850000, porSesion: 85000 },
        ],
        reservableIndividualmente: true,
      },
    ],
  },
  {
    id: "prescripcion-ejercicio",
    nombre: "Prescripción de ejercicio",
    descripcion: "Sesiones de 1 hora, individuales o grupales.",
    servicios: [
      {
        slug: "prescripcion-individual",
        nombre: "Plan personalizado (individual)",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion: "Plan de ejercicio ajustado a tus objetivos y tu proceso.",
        opciones: [
          { label: "Sesión individual", precio: 60000 },
          { label: "Paquete de 8 sesiones", precio: 400000, porSesion: 50000 },
          { label: "Paquete de 12 sesiones", precio: 580000, porSesion: 48333 },
          { label: "Paquete de 16 sesiones", precio: 720000, porSesion: 45000 },
          { label: "Paquete de 20 sesiones", precio: 800000, porSesion: 40000 },
        ],
        reservableIndividualmente: true,
      },
      {
        slug: "prescripcion-grupal-4",
        nombre: "Plan grupal (4 personas)",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion: "Precio por persona, grupo de 4 personas.",
        opciones: [
          { label: "4 sesiones (precio por persona)", precio: 150000, porSesion: 37500 },
        ],
        reservableIndividualmente: false,
      },
      {
        slug: "prescripcion-grupal-8",
        nombre: "Plan grupal (hasta 8 personas)",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion: "Precio por persona, grupo de hasta 8 personas.",
        opciones: [
          { label: "8 sesiones (precio por persona)", precio: 227000, porSesion: 28375 },
          { label: "12 sesiones (precio por persona)", precio: 312000, porSesion: 26000 },
          { label: "16 sesiones (precio por persona)", precio: 384000, porSesion: 24000 },
          { label: "20 sesiones (precio por persona)", precio: 440000, porSesion: 22000 },
        ],
        reservableIndividualmente: false,
      },
    ],
  },
  {
    id: "modulacion-postejercicio",
    nombre: "Modulación postejercicio / descargas musculares",
    descripcion: "Sesiones de 1 hora.",
    servicios: [
      {
        slug: "descarga-espalda",
        nombre: "Descarga — espalda",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion:
          "Espalda alta y baja en su totalidad. Terapia manual, terapia instrumental, ventosas (cupping) y pistola percutora.",
        opciones: [{ label: "Sesión", precio: 70000 }],
        reservableIndividualmente: true,
      },
      {
        slug: "descarga-miembros-inferiores",
        nombre: "Descarga — miembros inferiores",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion:
          "Muslos, piernas y pies en su totalidad. Presoterapia, terapia manual, terapia instrumental y pistola percutora.",
        opciones: [{ label: "Sesión", precio: 90000 }],
        reservableIndividualmente: true,
      },
      {
        slug: "descarga-cuerpo-completo",
        nombre: "Descarga — cuerpo completo",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion:
          "Miembros inferiores, espalda, miembros superiores, cuello y pecho. Presoterapia, terapia manual, instrumental, termoterapia, ventosas y pistola percutora.",
        opciones: [{ label: "Sesión", precio: 150000 }],
        reservableIndividualmente: true,
      },
    ],
  },
  {
    id: "procedimientos-especializados",
    nombre: "Procedimientos especializados",
    servicios: [
      {
        slug: "puncion-seca",
        nombre: "Punción seca",
        duracion: "1 hora",
        duracionMin: 60,
        descripcion: "Procedimiento especializado para puntos gatillo miofasciales.",
        opciones: [
          { label: "Sesión individual", precio: 120000 },
          { label: "Paquete de 5 sesiones", precio: 525000, porSesion: 105000 },
          { label: "Paquete de 10 sesiones", precio: 950000, porSesion: 95000 },
        ],
        reservableIndividualmente: true,
      },
      {
        slug: "terapia-neural",
        nombre: "Terapia neural",
        duracion: "1 a 2 horas",
        duracionMin: 90,
        descripcion: "Procedimiento especializado con fines terapéuticos.",
        opciones: [
          { label: "Sesión individual", precio: 150000 },
          { label: "Paquete de 5 sesiones", precio: 525000, porSesion: 105000 },
          { label: "Paquete de 10 sesiones", precio: 950000, porSesion: 95000 },
        ],
        reservableIndividualmente: true,
      },
      {
        slug: "prp",
        nombre: "Plasma rico en plaquetas (PRP)",
        duracion: "1 a 2 horas",
        duracionMin: 90,
        descripcion: "Procedimiento especializado de regeneración tisular.",
        opciones: [
          { label: "Sesión individual", precio: 250000 },
          { label: "Paquete de 5 sesiones", precio: 1000000, porSesion: 200000 },
          { label: "Paquete de 10 sesiones", precio: 1600000, porSesion: 160000 },
        ],
        reservableIndividualmente: true,
      },
      {
        slug: "sueroterapia",
        nombre: "Sueroterapia",
        duracion: "90 minutos",
        duracionMin: 90,
        descripcion: "Procedimiento especializado de 1 hora y media.",
        opciones: [
          { label: "Sesión individual", precio: 300000 },
          { label: "Paquete de 5 sesiones", precio: 1025000, porSesion: 205000 },
          { label: "Paquete de 10 sesiones", precio: 1900000, porSesion: 190000 },
        ],
        reservableIndividualmente: true,
      },
    ],
  },
];

export const promociones = {
  valoracionGratis:
    "La valoración inicial es gratis al adquirir cualquier paquete de terapias de rehabilitación.",
  referidos:
    "Por cada 5 pacientes referidos que agenden y asistan, el paciente referente obtiene 10% de descuento en su próximo servicio o paquete.",
};

export const politicas = {
  reserva:
    "Se requiere el pago por adelantado del 100% para confirmar el agendamiento de cualquier consulta o terapia.",
  reagendamiento:
    "Los cambios de agenda deben realizarse con mínimo 24 a 48 horas de anticipación. Si el paciente no asiste o cancela fuera de este plazo, la cita se dará por realizada y se perderá el valor pagado.",
  convenios:
    "Convenios y eventos (clubes/equipos) se gestionan mediante propuesta personalizada, con un abono inicial mínimo de $400.000.",
  mediosPago: ["Nequi / Llave: 311 398 1422 (Titular: Lina Murillo)", "Efectivo"],
};

// Vista plana de los servicios reservables individualmente, para el wizard
// de reservas y el preview del home. Los planes grupales y convenios no
// entran acá porque se gestionan por contacto directo, no por el wizard.
export const servicios = catalogo
  .flatMap((c) => c.servicios)
  .filter((s) => s.reservableIndividualmente)
  .map((s) => ({
    slug: s.slug,
    nombre: s.nombre,
    descripcion: s.descripcion,
    duracionMin: s.duracionMin,
  }));

// Selección curada para la vista previa del home (no todos, para no saturar).
export const serviciosDestacados = servicios.filter((s) =>
  [
    "valoracion-inicial",
    "rehabilitacion-fisica",
    "prescripcion-individual",
    "descarga-cuerpo-completo",
  ].includes(s.slug)
);

// Simulación de horarios disponibles. En producción esto vendría de un
// endpoint (backend/n8n) según servicio + fecha.
export function horariosDisponibles(fecha: Date): string[] {
  const base = ["08:00", "09:00", "10:30", "11:30", "14:00", "15:00", "16:30"];
  const diaSemana = fecha.getDay(); // 0 domingo
  if (diaSemana === 0) return [];
  // Simula que algunos horarios ya están ocupados según el día.
  return base.filter((_, i) => (diaSemana + i) % 4 !== 0);
}

// Reservas de ejemplo para el panel administrativo.
export type Reserva = {
  id: string;
  cliente: string;
  servicio: string;
  fecha: string;
  hora: string;
  estado: "confirmada" | "pendiente" | "cancelada";
};

export const reservasEjemplo: Reserva[] = [
  { id: "1", cliente: "Ana Torres", servicio: "Valoración inicial", fecha: "2026-09-02", hora: "09:00", estado: "confirmada" },
  { id: "2", cliente: "Juan Pérez", servicio: "Rehabilitación / terapia física", fecha: "2026-09-02", hora: "11:30", estado: "confirmada" },
  { id: "3", cliente: "Laura Gómez", servicio: "Plan personalizado (individual)", fecha: "2026-09-02", hora: "15:00", estado: "pendiente" },
  { id: "4", cliente: "Carlos Ruiz", servicio: "Descarga — cuerpo completo", fecha: "2026-09-03", hora: "08:00", estado: "confirmada" },
  { id: "5", cliente: "María Díaz", servicio: "Punción seca", fecha: "2026-09-03", hora: "14:00", estado: "cancelada" },
];

// Perfil real de la profesional (documento entregado por la clienta).
export const perfil = {
  nombreProfesional: "La Fisioterapeuta Li",
  nombreCompleto: "Lina Murillo",
  formacion: [
    "Fisioterapeuta — Universidad de Boyacá",
    "Especialización y Maestría en Neurorehabilitación (en formación) — Universidad Autónoma de Manizales",
  ],
  certificaciones: [
    "Diplomado en Terapias Alternativas — Fisioterapia en Movimiento",
    "Certificación en ATM (Articulación Temporomandibular) y Bruxismo — CAAFYR",
    "Diplomado Internacional en Rehabilitación Deportiva — CRAPTICA",
  ],
  areasEnfoque: ["Neurorrehabilitación", "Rehabilitación Deportiva"],
  sedes: [
    { nombre: "Sede Tunja (Boyacá)", horario: "Atención entre semana (lunes a viernes)" },
    { nombre: "Sede Turmequé (Boyacá)", horario: "Atención fines de semana (sábados y domingos)" },
  ],
  horarioGeneral: "Lunes a domingo, 7:00 a.m. a 8:00 p.m. (almuerzo: 12:00 p.m. a 2:00 p.m.)",
};

// Reseñas de ejemplo -- placeholder hasta tener testimonios reales de pacientes.
export type Resena = {
  nombre: string;
  calificacion: 1 | 2 | 3 | 4 | 5;
  comentario: string;
  servicio: string;
  fecha: string; // YYYY-MM-DD
  sede?: "Tunja" | "Turmequé";
};

export const resenasEjemplo: Resena[] = [
  {
    nombre: "Camila R.",
    calificacion: 5,
    comentario:
      "Llegué con dolor lumbar crónico y en pocas sesiones noté la diferencia. Lina explica cada técnica antes de aplicarla, eso me dio mucha confianza.",
    servicio: "Rehabilitación física",
    fecha: "2026-08-12",
    sede: "Tunja",
  },
  {
    nombre: "Andrés F.",
    calificacion: 5,
    comentario:
      "El plan de ejercicio personalizado se ajustó a mi horario de entrenamiento. Muy profesional y puntual en cada sesión.",
    servicio: "Prescripción de ejercicio",
    fecha: "2026-08-05",
    sede: "Tunja",
  },
  {
    nombre: "Paula M.",
    calificacion: 4,
    comentario:
      "La descarga muscular de cuerpo completo después de mi maratón fue justo lo que necesitaba para recuperarme rápido.",
    servicio: "Modulación postejercicio",
    fecha: "2026-07-28",
    sede: "Turmequé",
  },
  {
    nombre: "Diego H.",
    calificacion: 5,
    comentario:
      "La punción seca me sacó de un dolor de hombro que llevaba meses arrastrando. Explica cada paso y el procedimiento se siente seguro.",
    servicio: "Punción seca",
    fecha: "2026-07-15",
    sede: "Tunja",
  },
  {
    nombre: "Valentina S.",
    calificacion: 5,
    comentario:
      "Empecé el paquete de 10 sesiones de rehabilitación después de una cirugía de rodilla. El seguimiento sesión a sesión se nota, ajusta el plan según cómo voy avanzando.",
    servicio: "Rehabilitación física",
    fecha: "2026-07-02",
    sede: "Turmequé",
  },
  {
    nombre: "Julián P.",
    calificacion: 4,
    comentario:
      "Buena atención y puntualidad. Lo único es que a veces hay que esperar un poco si la sesión anterior se extiende.",
    servicio: "Modulación postejercicio",
    fecha: "2026-06-20",
    sede: "Tunja",
  },
  {
    nombre: "Marcela G.",
    calificacion: 5,
    comentario:
      "La sueroterapia combinada con las sesiones de rehabilitación aceleró muchísimo mi recuperación. Se nota la formación en neurorehabilitación.",
    servicio: "Sueroterapia",
    fecha: "2026-06-08",
    sede: "Tunja",
  },
];
