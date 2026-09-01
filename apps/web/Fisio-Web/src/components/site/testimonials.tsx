import { Star, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/site/reveal";
import { resenasEjemplo } from "@/lib/data";

export function Testimonials() {
  const destacadas = resenasEjemplo.slice(0, 3);

  return (
    <section className="bg-white py-4">
      <Container>
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="font-display text-3xl text-ink-900">
              Lo que cuentan quienes ya vinieron
            </h2>
            <p className="mt-2 max-w-md text-ink-600">
              Experiencias reales de pacientes atendidos en consulta.
            </p>
          </div>
          <Link
            to="/resenas"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-deep-600 hover:text-deep-700 sm:flex"
          >
            Ver todas <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 pb-16 sm:grid-cols-3">
          {destacadas.map((r, i) => (
            <Reveal key={r.nombre} delayMs={i * 100}>
              <figure className="flex h-full flex-col justify-between rounded-2xl border border-sky-100 bg-mist p-6">
                <div>
                  <div className="flex gap-0.5" aria-label={`${r.calificacion} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        size={16}
                        className={
                          j < r.calificacion
                            ? "fill-azure-500 text-azure-500"
                            : "fill-sky-100 text-sky-100"
                        }
                      />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-sm text-ink-600">
                    &ldquo;{r.comentario}&rdquo;
                  </blockquote>
                </div>
                <figcaption className="mt-6 text-sm">
                  <span className="font-medium text-ink-900">{r.nombre}</span>
                  <span className="text-ink-600"> · {r.servicio}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <Link
          to="/resenas"
          className="flex items-center gap-1 pb-16 text-sm font-medium text-deep-600 sm:hidden"
        >
          Ver todas las reseñas <ArrowUpRight size={16} />
        </Link>
      </Container>
    </section>
  );
}
