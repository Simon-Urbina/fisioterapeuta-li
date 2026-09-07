// Generación de reportes en el panel administrativo.
// Todo ocurre en el navegador (sin red). `xlsx` y `jspdf` se cargan con
// import() dinámico para no engordar el chunk inicial del sitio.

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
    XLSX.utils.book_append_sheet(wb, ws, hoja.nombre.slice(0, 31));
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
 * Descarga un PDF con cabecera de marca + tabla (jspdf-autotable) y pie
 * con numeración de página.
 */
export async function exportarPDF({
  base,
  titulo,
  subtitulo,
  columnas,
  filas,
  meta = [],
}: OpcionesPDF) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();

  // Cabecera de marca
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(11, 66, 114); // brand-900
  doc.text("La Fisioterapeuta Li", 40, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(titulo, 40, 62);

  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  let y = 78;
  if (subtitulo) {
    doc.text(subtitulo, 40, y);
    y += 13;
  }
  for (const linea of meta) {
    doc.text(linea, 40, y);
    y += 13;
  }
  doc.text(`Generado el ${fechaLegible()}`, ancho - 40, 42, { align: "right" });

  autoTable(doc, {
    head: [columnas],
    body: filas.map((f) => f.map((c) => String(c ?? ""))),
    startY: y + 6,
    styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: [1, 93, 167], textColor: 255, fontStyle: "bold" }, // brand-700
    alternateRowStyles: { fillColor: [240, 247, 255] }, // brand-50
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const n = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${doc.getCurrentPageInfo().pageNumber} de ${n}`,
        ancho - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" }
      );
    },
  });

  doc.save(`${nombreArchivo(base)}.pdf`);
}
