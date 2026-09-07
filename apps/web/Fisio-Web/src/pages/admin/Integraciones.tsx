import type { ComponentType } from "react";
import { RefreshCw, CalendarDays, Mail, FolderOpen, Table2, Plug } from "lucide-react";
import { motion } from "framer-motion";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader, Badge } from "@/components/admin/kit";
import { RevealGroup, RevealItem } from "@/components/site/reveal";
import { TiltCard } from "@/components/site/tilt-card";
import { TelegramIcon } from "@/components/site/telegram-icon";
import { integracionesEjemplo, type Integracion } from "@/lib/data";

const meta: Record<
  Integracion["estado"],
  { tono: "verde" | "ambar" | "gris"; texto: string; ring: string }
> = {
  conectado: { tono: "verde", texto: "Conectado", ring: "ring-emerald-200" },
  requiere_atencion: {
    tono: "ambar",
    texto: "Requiere atención",
    ring: "ring-amber-300",
  },
  no_configurado: {
    tono: "gris",
    texto: "No configurado",
    ring: "ring-slate-200",
  },
};

// Ícono por servicio. Telegram usa el ícono de marca del sitio.
const iconos: Record<string, ComponentType<{ size?: number }> | "telegram"> = {
  calendar: CalendarDays,
  gmail: Mail,
  drive: FolderOpen,
  sheets: Table2,
  telegram: "telegram",
};

function IntegracionIcon({ id, size = 20 }: { id: string; size?: number }) {
  const entry = iconos[id];
  if (entry === "telegram") return <TelegramIcon size={size} />;
  const Icon = entry ?? Plug;
  return <Icon size={size} />;
}

function AccionBtn({ i }: { i: Integracion }) {
  return (
    <motion.button
      whileTap={{ rotate: 180 }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-1.5 font-medium text-deep-600 hover:text-deep-700"
      type="button"
    >
      <RefreshCw size={13} />
      {i.estado === "requiere_atencion" ? "Reconectar" : "Probar"}
    </motion.button>
  );
}

// Banner horizontal para el servicio destacado (normalmente el que
// requiere atención) -- ancho completo, altura de una fila, sin huecos.
function IntegracionBanner({ i, className }: { i: Integracion; className?: string }) {
  const m = meta[i.estado];
  return (
    <RevealItem className={className}>
      <TiltCard
        max={3}
        className="card-raised flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6"
      >
        <div className="flex items-center gap-3 sm:w-60 sm:shrink-0">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-deep-600 ring-1 ${m.ring}`}
          >
            <IntegracionIcon id={i.id} size={22} />
          </span>
          <div>
            <p className="font-display font-bold text-ink-900">{i.nombre}</p>
            <p className="text-sm text-ink-600">{i.descripcion}</p>
          </div>
        </div>

        <p className="flex-1 text-sm text-ink-600">{i.detalle}</p>

        <div className="flex items-center justify-between gap-4 border-t border-sky-100 pt-3 text-xs text-ink-600 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <Badge tono={m.tono}>{m.texto}</Badge>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">
              {i.ultimoEvento ? `Último evento: ${i.ultimoEvento}` : "Sin actividad"}
            </span>
            <AccionBtn i={i} />
          </div>
        </div>
      </TiltCard>
    </RevealItem>
  );
}

function TarjetaIntegracion({ i }: { i: Integracion }) {
  const m = meta[i.estado];
  return (
    <RevealItem>
      <TiltCard className="h-full rounded-2xl border border-sky-100 bg-white p-5 shadow-sm shadow-brand-900/5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-deep-600 ring-1 ${m.ring}`}
          >
            <IntegracionIcon id={i.id} size={20} />
          </span>
          <Badge tono={m.tono}>{m.texto}</Badge>
        </div>

        <p className="mt-3 font-semibold text-ink-900">{i.nombre}</p>
        <p className="mt-0.5 text-sm text-ink-600">{i.descripcion}</p>
        <p className="mt-2 text-sm text-ink-600">{i.detalle}</p>

        <div className="mt-4 flex items-center justify-between border-t border-sky-100 pt-3 text-xs text-ink-600">
          <span>
            {i.ultimoEvento ? `Último evento: ${i.ultimoEvento}` : "Sin actividad"}
          </span>
          <AccionBtn i={i} />
        </div>
      </TiltCard>
    </RevealItem>
  );
}

export default function AdminIntegracionesPage() {
  const conectadas = integracionesEjemplo.filter(
    (i) => i.estado === "conectado"
  ).length;

  const destacada =
    integracionesEjemplo.find((i) => i.estado === "requiere_atencion") ??
    integracionesEjemplo[0];
  const resto = integracionesEjemplo.filter((i) => i.id !== destacada?.id);

  return (
    <AdminShell>
      <PageHeader
        title="Integraciones"
        subtitle={`${conectadas} de ${integracionesEjemplo.length} servicios conectados.`}
      />

      <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {destacada && (
          <IntegracionBanner i={destacada} className="sm:col-span-2 lg:col-span-4" />
        )}
        {resto.map((i) => (
          <TarjetaIntegracion key={i.id} i={i} />
        ))}
      </RevealGroup>

      <p className="mt-8 rounded-xl border border-sky-100 p-4 text-xs text-ink-600">
        El estado en vivo vendrá de <code>GET /health</code> de la API núcleo. Las
        credenciales de Google Workspace se guardan y renuevan en el servidor; el
        panel solo muestra el estado de cada conexión.
      </p>
    </AdminShell>
  );
}
