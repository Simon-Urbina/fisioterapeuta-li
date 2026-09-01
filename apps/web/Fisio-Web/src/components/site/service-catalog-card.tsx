
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP, cn } from "@/lib/utils";
import type { ServicioCatalogo } from "@/lib/data";

const WHATSAPP = "https://wa.me/573113981422";

export function ServiceCatalogCard({ servicio }: { servicio: ServicioCatalogo }) {
  const [open, setOpen] = useState(false);
  const base = servicio.opciones[0];

  return (
    <article className="rounded-2xl border border-sky-100 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg text-ink-900">{servicio.nombre}</h3>
          <p className="mt-1 text-sm text-ink-600">{servicio.descripcion}</p>
        </div>
        <span className="shrink-0 text-xs text-azure-500">{servicio.duracion}</span>
      </div>

      {servicio.notaPromo && (
        <p className="mt-3 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-deep-600">
          {servicio.notaPromo}
        </p>
      )}

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-2xl text-ink-900">
          {formatCOP(base.porSesion ?? base.precio)}
        </span>
        {servicio.opciones.length > 1 && (
          <span className="text-sm text-ink-600">por sesión desde</span>
        )}
      </div>

      {servicio.opciones.length > 1 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-deep-600"
        >
          Ver precios y paquetes
          <ChevronDown
            size={16}
            className={cn("transition-transform", open && "rotate-180")}
          />
        </button>
      )}

      {open && (
        <ul className="mt-3 space-y-2 border-t border-sky-100 pt-3">
          {servicio.opciones.map((o) => (
            <li key={o.label} className="flex items-center justify-between text-sm">
              <span className="text-ink-600">{o.label}</span>
              <span className="font-medium text-ink-900">
                {formatCOP(o.precio)}
                {o.porSesion && (
                  <span className="ml-1 font-normal text-ink-600">
                    ({formatCOP(o.porSesion)} c/u)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        {servicio.reservableIndividualmente ? (
          <Button href={`/reservar?servicio=${servicio.slug}`} size="sm" variant="secondary" className="w-full">
            Reservar
          </Button>
        ) : (
          <Button href={WHATSAPP} size="sm" variant="secondary" className="w-full">
            Escríbenos para coordinar
          </Button>
        )}
      </div>
    </article>
  );
}
