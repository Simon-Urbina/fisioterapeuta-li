import { useMemo, useState } from "react";
import { Search, X, Phone, Mail, MapPin, Gift } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader, Badge } from "@/components/admin/kit";
import { Reveal } from "@/components/site/reveal";
import {
  pacientesEjemplo,
  reservasEjemplo,
  type PacienteEjemplo,
} from "@/lib/data";
import { cn } from "@/lib/utils";

export default function AdminClientesPage() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<PacienteEjemplo | null>(null);

  const citasPorPaciente = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reservasEjemplo)
      map.set(r.cliente, (map.get(r.cliente) ?? 0) + 1);
    return map;
  }, []);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pacientesEjemplo.filter(
      (p) =>
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        p.documento.toLowerCase().includes(term) ||
        p.telefono.includes(term)
    );
  }, [q]);

  return (
    <AdminShell>
      <PageHeader
        title="Clientes"
        subtitle={`${pacientesEjemplo.length} pacientes con ficha registrada.`}
        action={
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o documento"
              className="fisio-input w-72 pl-9"
            />
          </div>
        }
      />

      <div className="mt-6 grid gap-3">
        {filtrados.map((p, i) => {
          const citas = citasPorPaciente.get(p.nombre) ?? 0;
          return (
            <Reveal key={p.id} delayMs={Math.min(i, 8) * 50}>
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setSel(p)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-white p-5 text-left shadow-sm shadow-brand-900/5 transition-colors hover:border-sky-300"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{p.nombre}</p>
                  <p className="truncate text-sm text-ink-600">
                    {p.documento} · {p.ciudad} · {p.eps}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.referidosEfectivos >= 5 && (
                    <Badge tono="verde">10% OFF</Badge>
                  )}
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-deep-600">
                    {citas} {citas === 1 ? "cita" : "citas"}
                  </span>
                </div>
              </motion.button>
            </Reveal>
          );
        })}
        {filtrados.length === 0 && (
          <p className="text-sm text-ink-600">Sin resultados.</p>
        )}
      </div>

      <AnimatePresence>
        {sel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex justify-end bg-ink-900/30"
            onClick={() => setSel(null)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-ink-900">
                  {sel.nombre}
                </h2>
                <p className="text-sm text-ink-600">{sel.documento}</p>
              </div>
              <button
                onClick={() => setSel(null)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-ink-600 hover:bg-sky-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-1.5 text-sm text-ink-600">
              <p className="flex items-center gap-2">
                <Phone size={14} className="text-azure-500" /> {sel.telefono}
              </p>
              <p className="flex items-center gap-2">
                <Mail size={14} className="text-azure-500" /> {sel.email}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} className="text-azure-500" /> {sel.ciudad}
              </p>
            </div>

            <Dl>
              <Row k="EPS / Aseguradora" v={sel.eps} />
              <Row k="Ocupación / Perfil" v={sel.ocupacion} />
              <Row k="Contacto de emergencia" v={sel.contactoEmergencia} />
              <Row k="Última sesión" v={sel.ultimaSesion} />
              <Row
                k="¿Quién lo refirió?"
                v={sel.referido ?? "—"}
              />
            </Dl>

            <div className="mt-5 rounded-xl bg-mist p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Gift size={15} className="text-deep-600" />
                Programa de referidos
              </p>
              <div className="mt-3 flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-2 flex-1 rounded-full",
                      i < sel.referidosEfectivos ? "gradient-bg" : "bg-sky-100"
                    )}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-600">
                {sel.referidosEfectivos} de 5 referidos efectivos.{" "}
                {sel.referidosEfectivos >= 5
                  ? "Aplica 10% OFF en el próximo servicio."
                  : `Faltan ${5 - sel.referidosEfectivos} para el 10% OFF.`}
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-sky-100 p-4 text-xs text-ink-600">
              La historia clínica (signos vitales, escala EVA, evolución) está
              fuera del alcance de esta versión.
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return (
    <dl className="mt-5 divide-y divide-sky-100 border-y border-sky-100">
      {children}
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-ink-600">{k}</dt>
      <dd className="text-right font-medium text-ink-900">{v}</dd>
    </div>
  );
}
