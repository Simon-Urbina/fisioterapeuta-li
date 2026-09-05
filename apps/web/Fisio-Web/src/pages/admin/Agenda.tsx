import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, MapPin } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader, Metric, Badge, TableCard, Th } from "@/components/admin/kit";
import { Reveal } from "@/components/site/reveal";
import { estadoReservaTono } from "@/components/admin/estado";
import { reservasEjemplo } from "@/lib/data";

const HOY = "2026-09-03";

function fmtFecha(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function AdminAgendaPage() {
  const [vista, setVista] = useState<"dia" | "semana">("dia");

  const ordenadas = useMemo(
    () =>
      [...reservasEjemplo].sort(
        (a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)
      ),
    []
  );

  const delDia = ordenadas.filter((r) => r.fecha === HOY);
  const confirmadas = reservasEjemplo.filter((r) => r.estado === "confirmada").length;
  const pendientes = reservasEjemplo.filter((r) => r.estado === "pendiente").length;

  const visibles = vista === "dia" ? delDia : ordenadas;
  const porFecha = useMemo(() => {
    const map = new Map<string, typeof visibles>();
    for (const r of visibles) {
      map.set(r.fecha, [...(map.get(r.fecha) ?? []), r]);
    }
    return [...map.entries()];
  }, [visibles]);

  return (
    <AdminShell>
      <PageHeader
        title="Agenda"
        subtitle="Sesiones registradas desde el sitio web y Telegram."
        action={
          <div className="flex rounded-lg border border-sky-300 bg-white p-0.5 text-sm font-medium">
            {(["dia", "semana"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={
                  "rounded-md px-3 py-1.5 transition-colors " +
                  (vista === v
                    ? "bg-deep-600 text-white"
                    : "text-ink-600 hover:bg-sky-100")
                }
              >
                {v === "dia" ? "Día" : "Semana"}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric index={0} label="Citas hoy" value={delDia.length} icon={<CalendarDays size={18} />} />
        <Metric index={1} label="Confirmadas" value={confirmadas} icon={<CheckCircle2 size={18} />} />
        <Metric index={2} label="Pendientes" value={pendientes} icon={<Clock3 size={18} />} />
      </div>

      <div className="mt-8 space-y-8">
        {porFecha.length === 0 && (
          <p className="text-sm text-ink-600">No hay citas para este rango.</p>
        )}
        {porFecha.map(([fecha, citas], i) => (
          <Reveal key={fecha} delayMs={i * 80}>
            <p className="mb-3 text-sm font-semibold capitalize text-ink-900">
              {fmtFecha(fecha)}
              {fecha === HOY && (
                <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-deep-600">
                  hoy
                </span>
              )}
            </p>
            <TableCard>
              <thead className="border-b border-sky-100 bg-sky-100/60 text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <Th>Hora</Th>
                  <Th>Cliente</Th>
                  <Th>Servicio</Th>
                  <Th>Sede</Th>
                  <Th>Canal</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {citas.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-sky-100 transition-colors last:border-0 hover:bg-mist"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink-900">{r.hora}</td>
                    <td className="px-5 py-3.5 text-ink-900">{r.cliente}</td>
                    <td className="px-5 py-3.5 text-ink-600">{r.servicio}</td>
                    <td className="px-5 py-3.5 text-ink-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} className="text-azure-500" />
                        {r.sede}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600">{r.canal}</td>
                    <td className="px-5 py-3.5">
                      <Badge tono={estadoReservaTono(r.estado)}>{r.estado}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </Reveal>
        ))}
      </div>
    </AdminShell>
  );
}
