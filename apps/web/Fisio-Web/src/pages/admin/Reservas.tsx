import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader, Badge, TableCard, Th } from "@/components/admin/kit";
import { Reveal } from "@/components/site/reveal";
import { estadoReservaTono } from "@/components/admin/estado";
import { reservasEjemplo, type EstadoReserva } from "@/lib/data";
import { cn } from "@/lib/utils";

const estados: (EstadoReserva | "todas")[] = [
  "todas",
  "confirmada",
  "pendiente",
  "cancelada",
];

export default function AdminReservasPage() {
  const [estado, setEstado] = useState<(typeof estados)[number]>("todas");
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return reservasEjemplo
      .filter((r) => estado === "todas" || r.estado === estado)
      .filter(
        (r) =>
          !term ||
          r.cliente.toLowerCase().includes(term) ||
          r.servicio.toLowerCase().includes(term) ||
          r.sede.toLowerCase().includes(term)
      )
      .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  }, [estado, q]);

  const conteo = (e: EstadoReserva) =>
    reservasEjemplo.filter((r) => r.estado === e).length;

  return (
    <AdminShell>
      <PageHeader
        title="Reservas"
        subtitle={`${reservasEjemplo.length} reservas · ${conteo("confirmada")} confirmadas · ${conteo("pendiente")} pendientes · ${conteo("cancelada")} canceladas`}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {estados.map((e) => (
            <motion.button
              key={e}
              whileTap={{ scale: 0.94 }}
              onClick={() => setEstado(e)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                estado === e
                  ? "border-deep-600 bg-deep-600 text-white"
                  : "border-sky-300 bg-white text-ink-600 hover:bg-sky-100"
              )}
            >
              {e}
            </motion.button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente o servicio"
            className="fisio-input w-64 pl-9"
          />
        </div>
      </div>

      <Reveal className="mt-6">
        <TableCard>
          <thead className="border-b border-sky-100 bg-sky-100/60 text-xs uppercase tracking-wide text-ink-600">
            <tr>
              <Th>Fecha</Th>
              <Th>Hora</Th>
              <Th>Cliente</Th>
              <Th>Teléfono</Th>
              <Th>Servicio</Th>
              <Th>Sede</Th>
              <Th>Canal</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => (
              <tr
                key={r.id}
                className="border-b border-sky-100 transition-colors last:border-0 hover:bg-mist"
              >
                <td className="px-5 py-3.5 text-ink-600">{r.fecha}</td>
                <td className="px-5 py-3.5 text-ink-600">{r.hora}</td>
                <td className="px-5 py-3.5 font-medium text-ink-900">{r.cliente}</td>
                <td className="px-5 py-3.5 text-ink-600">{r.telefono}</td>
                <td className="px-5 py-3.5 text-ink-600">{r.servicio}</td>
                <td className="px-5 py-3.5 text-ink-600">{r.sede}</td>
                <td className="px-5 py-3.5 text-ink-600">{r.canal}</td>
                <td className="px-5 py-3.5">
                  <Badge tono={estadoReservaTono(r.estado)}>{r.estado}</Badge>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-ink-600">
                  No hay reservas con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </TableCard>
      </Reveal>
    </AdminShell>
  );
}
