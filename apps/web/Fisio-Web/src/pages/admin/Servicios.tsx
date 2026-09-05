import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader, Badge } from "@/components/admin/kit";
import { Reveal } from "@/components/site/reveal";
import { catalogo, bufferPorServicio } from "@/lib/data";
import { formatCOP } from "@/lib/utils";

export default function AdminServiciosPage() {
  const total = catalogo.reduce((n, c) => n + c.servicios.length, 0);

  return (
    <AdminShell>
      <PageHeader
        title="Servicios"
        subtitle={`${total} servicios en ${catalogo.length} categorías. Precios y duraciones del catálogo vigente.`}
      />

      <div className="mt-8 space-y-10">
        {catalogo.map((cat) => (
          <section key={cat.id}>
            <h2 className="font-display text-lg font-bold text-ink-900">
              {cat.nombre}
            </h2>
            {cat.descripcion && (
              <p className="mt-0.5 text-sm text-ink-600">{cat.descripcion}</p>
            )}

            <div className="mt-4 grid gap-4">
              {cat.servicios.map((s, i) => (
                <Reveal key={s.slug} delayMs={i * 50}>
                <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm shadow-brand-900/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">{s.nombre}</p>
                      <p className="mt-0.5 text-sm text-ink-600">{s.descripcion}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tono="azul" dot={false}>
                        {s.duracion}
                      </Badge>
                      <Badge tono="gris" dot={false}>
                        +{bufferPorServicio[s.slug] ?? 15} min prep.
                      </Badge>
                      {s.reservableIndividualmente ? (
                        <Badge tono="verde" dot={false}>
                          Reservable en línea
                        </Badge>
                      ) : (
                        <Badge tono="ambar" dot={false}>
                          Solo por contacto
                        </Badge>
                      )}
                    </div>
                  </div>

                  <table className="mt-4 w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-ink-600">
                      <tr>
                        <th className="py-1.5 font-semibold">Opción / paquete</th>
                        <th className="py-1.5 text-right font-semibold">Precio</th>
                        <th className="py-1.5 text-right font-semibold">Por sesión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.opciones.map((o) => (
                        <tr key={o.label} className="border-t border-sky-100">
                          <td className="py-2 text-ink-900">{o.label}</td>
                          <td className="py-2 text-right text-ink-900">
                            {formatCOP(o.precio)}
                          </td>
                          <td className="py-2 text-right text-ink-600">
                            {o.porSesion ? formatCOP(o.porSesion) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {s.notaPromo && (
                    <p className="mt-3 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-deep-600">
                      {s.notaPromo}
                    </p>
                  )}
                </div>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 rounded-xl border border-sky-100 p-4 text-xs text-ink-600">
        Vista de solo lectura. La edición del catálogo se hará desde la API
        núcleo cuando esté disponible.
      </p>
    </AdminShell>
  );
}
