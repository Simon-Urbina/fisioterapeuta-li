import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Reveal } from "@/components/site/reveal";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";
import { resenasEjemplo } from "@/lib/data";

const filtros = [5, 4, 3, 2, 1] as const;

export default function ResenasPage() {
  const [filtro, setFiltro] = useState<number | null>(null);

  const resenas = useMemo(
    () =>
      filtro
        ? resenasEjemplo.filter((r) => r.calificacion === filtro)
        : resenasEjemplo,
    [filtro]
  );

  const promedio = (
    resenasEjemplo.reduce((acc, r) => acc + r.calificacion, 0) /
    resenasEjemplo.length
  ).toFixed(1);

  return (
    <>
      <Navbar />
      <main>
        <section className="bg-white py-16 sm:py-20">
          <Container>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-deep-600">
                <span className="h-2 w-2 rounded-full gradient-bg" />
                Experiencias reales de pacientes
              </span>
              <h1 className="mt-4 font-display text-4xl text-ink-900">
                Reseñas
              </h1>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      className={
                        i < Math.round(Number(promedio))
                          ? "fill-azure-500 text-azure-500"
                          : "fill-sky-100 text-sky-100"
                      }
                    />
                  ))}
                </div>
                <p className="text-ink-600">
                  {promedio} de 5 · {resenasEjemplo.length} reseñas
                </p>
              </div>
            </Reveal>
          </Container>
        </section>

        <section className="bg-mist py-4">
          <Container className="pb-20">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFiltro(null)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  filtro === null
                    ? "border-deep-600 bg-deep-600 text-white"
                    : "border-sky-300 text-ink-600 hover:bg-sky-100"
                )}
              >
                Todas
              </button>
              {filtros.map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    filtro === f
                      ? "border-deep-600 bg-deep-600 text-white"
                      : "border-sky-300 text-ink-600 hover:bg-sky-100"
                  )}
                >
                  {f} <Star size={13} className="fill-current" />
                </button>
              ))}
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {resenas.map((r, i) => (
                <Reveal key={r.nombre + r.fecha} delayMs={(i % 4) * 90}>
                  <article className="flex h-full flex-col justify-between rounded-2xl border border-sky-100 bg-white p-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star
                              key={j}
                              size={15}
                              className={
                                j < r.calificacion
                                  ? "fill-azure-500 text-azure-500"
                                  : "fill-sky-100 text-sky-100"
                              }
                            />
                          ))}
                        </div>
                        <time className="text-xs text-ink-600">
                          {new Date(r.fecha + "T00:00:00").toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </div>
                      <blockquote className="mt-4 text-sm text-ink-600">
                        &ldquo;{r.comentario}&rdquo;
                      </blockquote>
                    </div>
                    <div className="mt-6 flex items-center justify-between text-sm">
                      <span className="font-medium text-ink-900">{r.nombre}</span>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-deep-600">
                        {r.servicio}
                      </span>
                    </div>
                    {r.sede && (
                      <p className="mt-2 text-xs text-ink-600">Sede {r.sede}</p>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>

            {resenas.length === 0 && (
              <p className="mt-8 text-sm text-ink-600">
                No hay reseñas con esa calificación todavía.
              </p>
            )}
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
