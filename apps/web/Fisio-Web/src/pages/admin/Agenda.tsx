import { AdminShell } from "@/components/admin/admin-shell";
import { reservasEjemplo } from "@/lib/data";
import { cn } from "@/lib/utils";

export default function AdminAgendaPage() {
  const hoy = reservasEjemplo.filter((r) => r.fecha === "2026-09-02");
  const confirmadas = reservasEjemplo.filter((r) => r.estado === "confirmada").length;
  const pendientes = reservasEjemplo.filter((r) => r.estado === "pendiente").length;

  return (
    <AdminShell active="Agenda">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink-900">Agenda</h1>
          <p className="mt-1 text-sm text-ink-600">
            Sesiones registradas desde el sitio web y Telegram.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric label="Citas hoy" value={hoy.length} />
        <Metric label="Confirmadas" value={confirmadas} />
        <Metric label="Pendientes" value={pendientes} />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-sky-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-sky-100 bg-sky-100/60 text-ink-600">
            <tr>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Servicio</th>
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Hora</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {reservasEjemplo.map((r) => (
              <tr key={r.id} className="border-b border-sky-100 last:border-0">
                <td className="px-5 py-3 text-ink-900">{r.cliente}</td>
                <td className="px-5 py-3 text-ink-600">{r.servicio}</td>
                <td className="px-5 py-3 text-ink-600">{r.fecha}</td>
                <td className="px-5 py-3 text-ink-600">{r.hora}</td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      r.estado === "confirmada" && "bg-sky-100 text-deep-600",
                      r.estado === "pendiente" && "bg-amber-100 text-amber-700",
                      r.estado === "cancelada" && "bg-red-100 text-red-700"
                    )}
                  >
                    {r.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-5">
      <p className="text-sm text-ink-600">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink-900">{value}</p>
    </div>
  );
}
