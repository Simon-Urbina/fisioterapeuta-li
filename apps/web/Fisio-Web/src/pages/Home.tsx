import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarCheck, MessageCircle, ShieldCheck, Gift, Users } from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { WaveDivider } from "@/components/site/wave-divider";
import { Testimonials } from "@/components/site/testimonials";
import { HeroMotif } from "@/components/site/hero-motif";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { serviciosDestacados, promociones } from "@/lib/data";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute left-1/2 top-24 h-[550px] w-[550px] -translate-x-1/2 rounded-full bg-brand-400/10 blur-[140px]" />

          <Container className="relative py-16 sm:py-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white px-4 py-1.5 text-xs font-semibold text-brand-900 shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full gradient-bg" />
                Lina Murillo · Fisioterapia &amp; Neurorrehabilitación
              </span>

              <h1 className="gradient-text mt-6 font-display text-4xl font-extrabold leading-[1.08] sm:text-5xl">
                Tu cuerpo se mueve mejor cuando alguien lo cuida bien.
              </h1>
              <p className="mx-auto mt-6 max-w-md text-base text-ink-600">
                Sesiones de fisioterapia personalizadas, agenda tu cita en
                minutos y recibe la confirmación al instante.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button href="/reservar" size="lg">
                  Reservar cita
                </Button>
                <Button href="/servicios" size="lg" variant="secondary">
                  Ver servicios
                </Button>
              </div>
            </Reveal>

            <Reveal delayMs={150} className="relative mx-auto mt-4 w-full max-w-sm">
              <HeroMotif />
            </Reveal>

            {/* Promociones reales */}
            <Reveal delayMs={250} className="mx-auto mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-sky-100 bg-white p-5 text-left shadow-sm shadow-brand-900/5 transition-colors hover:border-sky-300">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-deep-600">
                  <Gift size={14} /> Promoción
                </div>
                <p className="mt-1 font-display text-base font-bold text-ink-900">
                  Valoración inicial gratis
                </p>
                <p className="mt-1 text-xs text-ink-600">{promociones.valoracionGratis}</p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white p-5 text-left shadow-sm shadow-brand-900/5 transition-colors hover:border-sky-300">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-azure-500">
                  <Users size={14} /> Referidos
                </div>
                <p className="mt-1 font-display text-base font-bold text-ink-900">
                  10% OFF por referir
                </p>
                <p className="mt-1 text-xs text-ink-600">{promociones.referidos}</p>
              </div>
            </Reveal>

            <dl className="mt-14 flex justify-center gap-10">
              <div className="text-center">
                <dt className="font-display text-2xl text-deep-600">+500</dt>
                <dd className="text-sm text-ink-600">sesiones realizadas</dd>
              </div>
              <div className="text-center">
                <dt className="font-display text-2xl text-deep-600">4</dt>
                <dd className="text-sm text-ink-600">áreas de tratamiento</dd>
              </div>
              <div className="text-center">
                <dt className="font-display text-2xl text-deep-600">24/7</dt>
                <dd className="text-sm text-ink-600">reserva en línea</dd>
              </div>
            </dl>
          </Container>
        </section>

        <WaveDivider fill="var(--color-white)" className="bg-mist" />

        {/* Cómo funciona */}
        <section className="bg-white py-4">
          <Container>
            <div className="grid gap-6 sm:grid-cols-3">
              <Reveal>
                <Feature
                  number="01"
                  icon={<CalendarCheck className="text-deep-600" size={20} />}
                  title="Elige un horario"
                  text="Consulta la disponibilidad real y escoge el momento que te sirva."
                />
              </Reveal>
              <Reveal delayMs={120}>
                <Feature
                  number="02"
                  icon={<MessageCircle className="text-deep-600" size={20} />}
                  title="Recibe confirmación"
                  text="Te avisamos por correo apenas quede agendada tu sesión."
                />
              </Reveal>
              <Reveal delayMs={240}>
                <Feature
                  number="03"
                  icon={<ShieldCheck className="text-deep-600" size={20} />}
                  title="Asiste tranquilo"
                  text="Tu plan de tratamiento queda registrado y a la mano para tu terapeuta."
                />
              </Reveal>
            </div>
          </Container>
        </section>

        <WaveDivider fill="var(--color-sky-100)" className="bg-white" />

        {/* Servicios preview */}
        <section className="bg-sky-100 py-4">
          <Container>
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="font-display text-3xl text-ink-900">
                  Servicios
                </h2>
                <p className="mt-2 max-w-md text-ink-600">
                  Cada plan se ajusta a tu proceso de recuperación, no al
                  revés.
                </p>
              </div>
              <Link
                to="/servicios"
                className="hidden shrink-0 items-center gap-1 text-sm font-medium text-deep-600 hover:text-deep-700 sm:flex"
              >
                Ver todos <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-10 grid gap-6 pb-16 sm:grid-cols-2">
              {serviciosDestacados.map((s, i) => (
                <Reveal key={s.slug} delayMs={i * 100}>
                  <div className="rounded-2xl border border-transparent border-l-2 border-l-deep-600 bg-white p-6 shadow-sm shadow-brand-900/5">
                    <p className="font-display text-lg text-ink-900">
                      {s.nombre}
                    </p>
                    <p className="mt-2 text-sm text-ink-600">{s.descripcion}</p>
                    <p className="mt-4 text-xs font-medium text-azure-500">
                      Sesión de {s.duracionMin} minutos
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        <WaveDivider fill="var(--color-white)" className="bg-sky-100" />

        <Testimonials />
      </main>

      <Footer />
    </>
  );
}

function Feature({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm shadow-brand-900/5 transition-colors hover:border-sky-300">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100">
          {icon}
        </div>
        <span className="font-display text-sm font-bold text-sky-300">
          {number}
        </span>
      </div>
      <p className="mt-4 font-display text-lg text-ink-900">{title}</p>
      <p className="mt-1 text-sm text-ink-600">{text}</p>
    </div>
  );
}
