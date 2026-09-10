// Generación de reportes en el panel administrativo.
// Todo ocurre en el navegador (sin red). `xlsx` y `jspdf` se cargan con
// import() dinámico para no engordar el chunk inicial del sitio.

import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import type {
  PacienteAdminApi,
  AntecedentePacienteApi,
  AnamnesisApi,
  SignosVitalesApi,
  EvaluacionDolorApi,
  EvolucionApi,
  CitaPacienteApi,
} from "@/lib/api";

export type Fila = Record<string, string | number>;

export type HojaExcel = {
  nombre: string;
  filas: Fila[];
};

const HOY = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export function nombreArchivo(base: string) {
  return `fisio-li_${base}_${HOY()}`;
}

function fechaLegible() {
  return new Date().toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

// Paleta de marca (RGB) para el PDF.
const BRAND_900: [number, number, number] = [11, 66, 114];
const BRAND_700: [number, number, number] = [1, 93, 167];
const BRAND_200: [number, number, number] = [186, 224, 253];
const BRAND_50: [number, number, number] = [240, 247, 255];
const GRIS: [number, number, number] = [110, 110, 110];

// Geometría compartida por los PDF (papel A4, unidades en puntos).
const MARGEN = 40;
const HEADER_H = 74;

type Logo = { dataUrl: string; ratio: number };

// Fecha corta con hora para las tablas de la historia clínica.
function fFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

// Sólo fecha (para campos que son un día, no un instante). Si ya viene como
// AAAA-MM-DD la dejamos tal cual para no correrla por zona horaria.
function fFechaSolo(iso: string | null): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

// Logo de la clienta para la cabecera y la marca de agua. Se descarga
// una vez, se reescala en un canvas (el PNG original pesa ~600 KB) y se
// cachea como data URL para no rehacerlo en cada exportación.
let logoPromesa: Promise<{ dataUrl: string; ratio: number } | null> | undefined;

function cargarLogo() {
  if (!logoPromesa) {
    logoPromesa = new Promise((resolve) => {
      if (typeof Image === "undefined") return resolve(null);
      const img = new Image();
      img.onload = () => {
        try {
          const maxW = 680;
          const escala = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
          const w = Math.max(1, Math.round(img.naturalWidth * escala));
          const h = Math.max(1, Math.round(img.naturalHeight * escala));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, w, h);
          resolve({
            dataUrl: canvas.toDataURL("image/png"),
            ratio: img.naturalWidth / img.naturalHeight,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = "/images/Logo.png";
    });
  }
  return logoPromesa;
}

// --- Papel membretado compartido (cabecera, marca de agua, pie) -----------

function pintarMarcaDeAgua(doc: jsPDF, W: number, H: number, logo: Logo | null) {
  const anyDoc = doc as unknown as {
    setGState: (g: unknown) => void;
    GState: new (o: { opacity: number }) => unknown;
  };
  doc.saveGraphicsState();
  anyDoc.setGState(new anyDoc.GState({ opacity: 0.06 }));
  if (logo) {
    const w = W * 0.52;
    const h = w / logo.ratio;
    doc.addImage(logo.dataUrl, "PNG", (W - w) / 2, (H - h) / 2, w, h, "lfl-logo", "FAST");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(60);
    doc.setTextColor(...BRAND_900);
    doc.text("La Fisioterapeuta Li", W / 2, H / 2, { align: "center", angle: 22 });
  }
  doc.restoreGraphicsState();
}

function pintarMembrete(
  doc: jsPDF,
  W: number,
  logo: Logo | null,
  fecha: string,
  etiqueta: string,
) {
  doc.setFillColor(...BRAND_50);
  doc.rect(0, 0, W, HEADER_H, "F");
  doc.setDrawColor(...BRAND_200);
  doc.setLineWidth(0.8);
  doc.line(0, HEADER_H, W, HEADER_H);

  let textoX = MARGEN;
  if (logo) {
    const h = 42;
    const w = h * logo.ratio;
    doc.addImage(logo.dataUrl, "PNG", MARGEN, (HEADER_H - h) / 2, w, h, "lfl-logo", "FAST");
    textoX = MARGEN + w + 14;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BRAND_900);
  doc.text("La Fisioterapeuta Li", textoX, 31);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text("Fisioterapia & Neurorrehabilitación · Boyacá, Colombia", textoX, 45);

  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(etiqueta, W - MARGEN, 26, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(fecha, W - MARGEN, 40, { align: "right" });
}

function pintarPie(doc: jsPDF, W: number, H: number, pagina: number, totalExp: string) {
  doc.setDrawColor(...BRAND_200);
  doc.setLineWidth(0.5);
  doc.line(MARGEN, H - 30, W - MARGEN, H - 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  doc.text("La Fisioterapeuta Li", MARGEN, H - 18);
  const txt =
    typeof doc.putTotalPages === "function"
      ? `Página ${pagina} de ${totalExp}`
      : `Página ${pagina}`;
  doc.text(txt, W - MARGEN, H - 18, { align: "right" });
}

/**
 * Descarga un .xlsx con una o varias hojas. Las columnas se deducen de
 * las claves de la primera fila de cada hoja.
 */
export async function exportarExcel(base: string, hojas: HojaExcel[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const hoja of hojas) {
    const ws = XLSX.utils.json_to_sheet(hoja.filas);
    // Ancho de columna aproximado según el contenido más largo.
    const claves = hoja.filas[0] ? Object.keys(hoja.filas[0]) : [];
    ws["!cols"] = claves.map((k) => {
      const largo = Math.max(
        k.length,
        ...hoja.filas.map((f) => String(f[k] ?? "").length)
      );
      return { wch: Math.min(48, Math.max(10, largo + 2)) };
    });
    const nombreHoja = hoja.nombre.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  }

  XLSX.writeFile(wb, `${nombreArchivo(base)}.xlsx`, { compression: true });
}

type OpcionesPDF = {
  base: string;
  titulo: string;
  subtitulo?: string;
  columnas: string[];
  filas: (string | number)[][];
  /** líneas extra bajo el título (filtros aplicados, totales, etc.) */
  meta?: string[];
};

/**
 * Descarga un PDF con papel membretado (logo + banda de marca), marca de
 * agua en cada página, tabla (jspdf-autotable) y pie con numeración.
 */
export async function exportarPDF({
  base,
  titulo,
  subtitulo,
  columnas,
  filas,
  meta = [],
}: OpcionesPDF) {
  const [{ jsPDF }, autoTableMod, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    cargarLogo(),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = MARGEN; // margen lateral
  const fecha = fechaLegible();
  const totalExp = "{tot_pag}";

  // Alto del bloque de título (sólo va en la página 1).
  const tituloBloqueAlto = 30 + (subtitulo ? 14 : 0) + meta.length * 12;

  const marcaDeAgua = () => pintarMarcaDeAgua(doc, W, H, logo);

  const cabecera = (pagina: number) => {
    pintarMembrete(doc, W, logo, fecha, "REPORTE");

    if (pagina === 1) {
      let y = HEADER_H + 24;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text(titulo, M, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS);
      if (subtitulo) {
        doc.text(subtitulo, M, y);
        y += 13;
      }
      for (const l of meta) {
        doc.text(l, M, y);
        y += 12;
      }
    }
  };

  const pie = (pagina: number) => pintarPie(doc, W, H, pagina, totalExp);

  autoTable(doc, {
    head: [columnas],
    body: filas.map((f) => f.map((c) => String(c ?? ""))),
    startY: HEADER_H + tituloBloqueAlto,
    margin: { top: HEADER_H + 14, bottom: 44, left: M, right: M },
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 6,
      overflow: "linebreak",
      textColor: [45, 45, 45],
      lineColor: [223, 236, 250],
      lineWidth: 0.25,
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND_700,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 7,
    },
    alternateRowStyles: { fillColor: BRAND_50 },
    willDrawPage: (data) => {
      marcaDeAgua();
      cabecera(data.pageNumber);
    },
    didDrawPage: (data) => {
      pie(data.pageNumber);
    },
  });

  if (typeof doc.putTotalPages === "function") doc.putTotalPages(totalExp);
  doc.save(`${nombreArchivo(base)}.pdf`);
}

export type DatosHistoriaClinica = {
  antecedentes: AntecedentePacienteApi[];
  anamnesis: AnamnesisApi[];
  vitales: SignosVitalesApi[];
  dolor: EvaluacionDolorApi[];
  evolucion: EvolucionApi[];
  citas: CitaPacienteApi[];
};

/**
 * Descarga —directo, sin diálogo de impresión— la historia clínica de un
 * paciente en PDF, con el mismo papel membretado que los demás reportes:
 * logo, banda de marca, marca de agua y pie numerado. El cuerpo va en
 * secciones (antecedentes, anamnesis, signos vitales, dolor, evolución y
 * citas) armadas con jspdf-autotable, así el salto de página es automático.
 */
export async function exportarHistoriaClinicaPDF(
  paciente: PacienteAdminApi,
  datos: DatosHistoriaClinica,
) {
  const [{ jsPDF }, autoTableMod, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    cargarLogo(),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const fecha = fechaLegible();
  const totalExp = "{tot_pag}";

  // Bloque de identidad del paciente: sólo en la página 1, bajo el membrete.
  const IDENTIDAD_H = 74;
  const dibujarIdentidad = () => {
    let iy = HEADER_H + 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...BRAND_900);
    doc.text(paciente.nombre, MARGEN, iy);
    iy += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text(
      [
        paciente.documento,
        paciente.telefono ?? "sin teléfono",
        paciente.eps ?? "particular",
      ].join("   ·   "),
      MARGEN,
      iy,
    );
    iy += 12;
    doc.setFontSize(7.5);
    doc.text(
      `Historia clínica · generada el ${fecha} · documento confidencial de uso clínico`,
      MARGEN,
      iy,
    );
  };

  // autoTable dispara el hook de página en cada llamada, no sólo al saltar
  // de página, así que el membrete/marca/pie se pintan una vez por número.
  const pintadas = new Set<number>();
  const base: Partial<UserOptions> = {
    margin: { top: HEADER_H + 16, bottom: 44, left: MARGEN, right: MARGEN },
    willDrawPage: (data) => {
      if (pintadas.has(data.pageNumber)) return;
      pintadas.add(data.pageNumber);
      pintarMarcaDeAgua(doc, W, H, logo);
      pintarMembrete(doc, W, logo, fecha, "HISTORIA CLÍNICA");
      pintarPie(doc, W, H, data.pageNumber, totalExp);
      if (data.pageNumber === 1) dibujarIdentidad();
    },
  };

  let cursorY = HEADER_H + IDENTIDAD_H;
  const finalY = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const seccion = (titulo: string) => {
    autoTable(doc, {
      ...base,
      startY: cursorY + 16,
      body: [[titulo]],
      theme: "plain",
      styles: {
        font: "helvetica",
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: 6,
        fillColor: BRAND_700,
        textColor: 255,
      },
    });
    cursorY = finalY();
  };

  const kv = (filas: [string, string][]) => {
    autoTable(doc, {
      ...base,
      startY: cursorY + 4,
      body: filas.map(([k, v]) => [k, v || "—"]),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 6,
        overflow: "linebreak",
        textColor: [45, 45, 45],
        lineColor: [223, 236, 250],
        lineWidth: 0.25,
        valign: "top",
      },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: "bold", fillColor: BRAND_50, textColor: BRAND_900 },
      },
    });
    cursorY = finalY();
  };

  const tabla = (
    columnas: string[],
    filas: (string | number)[][],
    columnStyles?: UserOptions["columnStyles"],
  ) => {
    autoTable(doc, {
      ...base,
      startY: cursorY + 4,
      head: [columnas],
      body: filas.map((f) => f.map((c) => String(c ?? ""))),
      theme: "striped",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 6,
        overflow: "linebreak",
        textColor: [45, 45, 45],
        lineColor: [223, 236, 250],
        lineWidth: 0.25,
        valign: "top",
      },
      headStyles: {
        fillColor: BRAND_700,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: 6,
      },
      alternateRowStyles: { fillColor: BRAND_50 },
      ...(columnStyles ? { columnStyles } : {}),
    });
    cursorY = finalY();
  };

  const nota = (texto: string) => {
    autoTable(doc, {
      ...base,
      startY: cursorY + 4,
      body: [[texto]],
      theme: "plain",
      styles: {
        font: "helvetica",
        fontStyle: "italic",
        fontSize: 8.5,
        cellPadding: 6,
        textColor: GRIS,
      },
    });
    cursorY = finalY();
  };

  // --- Antecedentes ---
  seccion("Antecedentes");
  if (datos.antecedentes.length) {
    tabla(
      ["Antecedente", "Detalle"],
      datos.antecedentes.map((a) => [a.nombre, a.detalle ?? "—"]),
      { 0: { cellWidth: 180, fontStyle: "bold" } },
    );
  } else {
    nota("Sin antecedentes registrados.");
  }

  // --- Anamnesis ---
  seccion("Anamnesis (más reciente)");
  const ana = datos.anamnesis[0];
  if (ana) {
    kv([
      ["Registrada", fFecha(ana.registradoEn)],
      ["Motivo de consulta", ana.motivoConsulta ?? "—"],
      ["Enfermedad actual", ana.enfermedadActual ?? "—"],
      ["Inicio de síntomas", fFechaSolo(ana.inicioSintomas)],
      ["Causa aparente", ana.causaAparente ?? "—"],
      ["Tratamientos previos", ana.tratamientosPrevios ?? "—"],
      ["Respuesta a tratamientos", ana.respuestaTratamientos ?? "—"],
      ["Objetivos terapéuticos", ana.objetivosTerapeuticos ?? "—"],
    ]);
  } else {
    nota("Sin anamnesis registrada.");
  }

  // --- Signos vitales ---
  seccion("Signos vitales");
  if (datos.vitales.length) {
    tabla(
      ["Fecha", "TA", "FC", "FR", "SpO2", "IMC"],
      datos.vitales.map((v) => [
        fFecha(v.tomadoEn),
        `${v.sistolica ?? "—"}/${v.diastolica ?? "—"}`,
        v.frecuenciaCardiaca ?? "—",
        v.frecuenciaRespiratoria ?? "—",
        v.saturacionO2 ?? "—",
        v.imc ?? "—",
      ]),
    );
  } else {
    nota("Sin tomas registradas.");
  }

  // --- Dolor ---
  seccion("Evaluaciones de dolor");
  if (datos.dolor.length) {
    tabla(
      ["Fecha", "Intensidad", "Zona", "Tipo"],
      datos.dolor.map((d) => [
        fFecha(d.evaluadoEn),
        `${d.intensidad}/10 (${d.clasificacion})`,
        d.zona ?? "—",
        d.tiposDolor.join(", ") || "—",
      ]),
    );
  } else {
    nota("Sin evaluaciones registradas.");
  }

  // --- Evolución ---
  seccion("Evolución de sesiones");
  if (datos.evolucion.length) {
    tabla(
      ["Fecha", "S", "O", "A", "P"],
      datos.evolucion.map((e) => [
        fFecha(e.registradoEn),
        e.subjetivo ?? "—",
        e.objetivo ?? "—",
        e.analisis ?? "—",
        e.plan ?? "—",
      ]),
      { 0: { cellWidth: 74 } },
    );
  } else {
    nota("Sin notas de evolución.");
  }

  // --- Citas ---
  seccion("Historial de citas");
  if (datos.citas.length) {
    tabla(
      ["Fecha", "Servicio", "Sede", "Estado"],
      datos.citas.map((c) => [
        fFecha(c.iniciaEn),
        c.servicio ?? "—",
        c.sede,
        c.estado.replace(/_/g, " "),
      ]),
    );
  } else {
    nota("Sin citas registradas.");
  }

  if (typeof doc.putTotalPages === "function") doc.putTotalPages(totalExp);

  const sinTildes = new RegExp("[\\u0300-\\u036f]", "g");
  const slug =
    paciente.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(sinTildes, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "paciente";
  doc.save(`${nombreArchivo(`historia-clinica_${slug}`)}.pdf`);
}
