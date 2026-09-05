import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader, Badge, TableCard, Th } from "@/components/admin/kit";
import { Reveal } from "@/components/site/reveal";
import { operacionesEjemplo, type OperacionLog } from "@/lib/data";
import { cn } from "@/lib/utils";

const canales: (OperacionLog["canal"] | "todos")[] = [
  "todos",
  "Sitio web",
  "Telegram",
  "Panel",
  "n8n",
];

const tonoResultado: Record<OperacionLog["resultado"], "verde" | "rojo" | "ambar"> = {
  ok: "verde",
  error: "rojo",
  pendiente: "ambar",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminHistorialPage() {
  const [canal, setCanal] = useState<(typeof canales)[number]>("todos");

  const filtradas = useMemo(
    () =>
      [...operacionesEjemplo]
        .filter((o) => canal === "todos" || o.canal === canal)
        .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora)),
    [canal]
  );

  return (
    <AdminShell>
      <PageHeader
        title="Historial de operaciones"
        subtitle="Toda acción que modifica datos o dispara una automatización queda registrada."
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {canales.map((c) => (
          <motion.button
            key={c}
            whileTap={{ scale: 0.94 }}
            onClick={() => setCanal(c)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              canal === c
                ? "border-deep-600 bg-deep-600 text-white"
                : "border-sky-300 bg-white text-ink-600 hover:bg-sky-100"
            )}
          >
            {c}
          </motion.button>
        ))}
      </div>

      <Reveal className="mt-6">
        <TableCard>
          <thead className="border-b border-sky-100 bg-sky-100/60 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <Th>Fecha y hora</Th>
              <Th>Actor</Th>
              <Th>Canal</Th>
              <Th>Acción</Th>
              <Th>Detalle</Th>
              <Th>Resultado</Th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((o) => (
              <tr
                key={o.id}
                className="border-b border-sky-100 transition-colors last:border-0 hover:bg-mist"
              >
                <td className="whitespace-nowrap px-5 py-3.5 text-ink-600">
                  {fmt(o.fechaHora)}
                </td>
                <td className="px-5 py-3.5 text-ink-900">{o.actor}</td>
                <td className="px-5 py-3.5 text-ink-600">{o.canal}</td>
                <td className="px-5 py-3.5 font-medium text-ink-900">{o.accion}</td>
                <td className="px-5 py-3.5 text-ink-600">{o.detalle}</td>
                <td className="px-5 py-3.5">
                  <Badge tono={tonoResultado[o.resultado]}>{o.resultado}</Badge>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-ink-600">
                  Sin operaciones en este canal.
                </td>
              </tr>
            )}
          </tbody>
        </TableCard>
      </Reveal>
    </AdminShell>
  );
}
