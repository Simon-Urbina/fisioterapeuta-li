import { Gift, Users, CreditCard, CalendarClock } from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Reveal } from "@/components/site/reveal";
import { Showcase } from "@/components/site/showcase";
import { Container } from "@/components/ui/container";
import { ServiceCatalogCard } from "@/components/site/service-catalog-card";
import { catalogo, promociones, politicas } from "@/lib/data";

const vitrina = [
  {
    key: "valoracion-rehabilitacion",
    eyebrow: "Valoración y rehabilitación",
    title: "Evaluación y terapia física a tu ritmo",
    description:
      "Empezamos con una valoración completa para entender tu punto de partida, y desde ahí construimos un plan de rehabilitación con seguimiento sesión a sesión.",
    chipLabel: "Valoración inicial",
    chipValue: 100000,
    imageSrc: "/images/servicio-valoracion.jpg",
    imageAlt: "Valoración y rehabilitación física",
  },
  {
    key: "prescripcion-ejercicio",
    eyebrow: "Prescripción de ejercicio",
    title: "Planes de ejercicio individuales o grupales",
    description:
      "Programas ajustados a tus objetivos y tu proceso, con opción individual o en grupo -- ideal para mantenimiento y prevención, no solo para lesión.",
    chipLabel: "Plan personalizado",
    chipValue: 60000,
    imageSrc: "/images/servicio-rehabilitacion.jpg",
    imageAlt: "Prescripción de ejercicio",
  },
  {
    key: "modulacion-postejercicio",
    eyebrow: "Modulación postejercicio",
    title: "Descargas musculares por zona",
    description:
      "Presoterapia, terapia manual e instrumental, ventosas y pistola percutora -- por zona o cuerpo completo, pensado para tu recuperación después del esfuerzo físico.",
    chipLabel: "Descarga cuerpo completo",
    chipValue: 150000,
    imageSrc: "/images/servicio-descargas.jpg",
    imageAlt: "Modulación postejercicio",
  },
  {
    key: "procedimientos-especializados",
    eyebrow: "Procedimientos especializados",
    title: "Punción seca, terapia neural, PRP y sueroterapia",
    description:
      "Procedimientos especializados para casos que requieren un abordaje más específico, siempre explicando el porqué de cada técnica antes de aplicarla.",
    chipLabel: "Punción seca",
    chipValue: 120000,
    imageSrc: "/images/servicio-procedimientos.jpg",
    imageAlt: "Procedimientos especializados",
  },
];

export default function ServiciosPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="bg-white py-16 sm:py-20">
          <Container>
            <Reveal>
              <h1 className="gradient-text font-display text-4xl font-extrabold text-ink-900">
                Servicios
              </h1>
              <p className="mt-3 max-w-lg text-ink-600">
                Catálogo completo de sesiones individuales, paquetes y planes
                grupales. Los precios de paquete incluyen el valor por sesión.
              </p>
            </Reveal>
          </Container>
        </section>

        {/* Vitrina alternada por categoría */}
        <section className="bg-white py-4">
          <Container className="space-y-20 pb-20 sm:space-y-28">
            {vitrina.map((v, i) => (
              <Showcase
                key={v.key}
                index={i + 1}
                eyebrow={v.eyebrow}
                title={v.title}
                description={v.description}
                chipLabel={v.chipLabel}
                chipValue={v.chipValue}
                imageSrc={v.imageSrc}
                imageAlt={v.imageAlt}
                imageSide={i % 2 === 0 ? "right" : "left"}
              />
            ))}
          </Container>
        </section>

        {catalogo.map((cat, i) => (
          <section
            key={cat.id}
            className={i % 2 === 0 ? "bg-mist py-4" : "bg-sky-100 py-4"}
          >
            <Container className="py-12">
              <Reveal>
                <h2 className="font-display text-2xl text-ink-900">{cat.nombre}</h2>
                {cat.descripcion && (
                  <p className="mt-1 text-sm text-ink-600">{cat.descripcion}</p>
                )}
              </Reveal>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cat.servicios.map((s, j) => (
                  <Reveal key={s.slug} delayMs={j * 80}>
                    <ServiceCatalogCard servicio={s} />
                  </Reveal>
                ))}
              </div>
            </Container>
          </section>
        ))}

        {/* Promociones */}
        <section className="gradient-bg py-16 text-white">
          <Container className="grid gap-8 sm:grid-cols-2">
            <div className="flex gap-4">
              <Gift className="shrink-0" size={24} />
              <div>
                <p className="font-display text-lg">Valoración gratis</p>
                <p className="mt-1 text-sm text-sky-100">
                  {promociones.valoracionGratis}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Users className="shrink-0" size={24} />
              <div>
                <p className="font-display text-lg">Programa de referidos</p>
                <p className="mt-1 text-sm text-sky-100">
                  {promociones.referidos}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Políticas */}
        <section className="bg-white py-16">
          <Container>
            <Reveal>
              <h2 className="font-display text-2xl text-ink-900">
                Reserva, cambios y pagos
              </h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                <div>
                  <CalendarClock className="text-deep-600" size={22} />
                  <p className="mt-3 text-sm text-ink-600">{politicas.reserva}</p>
                </div>
                <div>
                  <CalendarClock className="text-deep-600" size={22} />
                  <p className="mt-3 text-sm text-ink-600">
                    {politicas.reagendamiento}
                  </p>
                </div>
                <div>
                  <CreditCard className="text-deep-600" size={22} />
                  <p className="mt-3 text-sm text-ink-600">
                    Medios de pago: {politicas.mediosPago.join(" · ")}
                  </p>
                </div>
              </div>
              <p className="mt-8 text-sm text-ink-600">{politicas.convenios}</p>
            </Reveal>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
