import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { WaveDivider } from "@/components/site/wave-divider";
import { Testimonials } from "@/components/site/testimonials";
import { HeroMotif } from "@/components/site/hero-motif";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { serviciosDestacados } from "@/lib/data";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        {/* Hero */}
        <section className="bg-white">
          <Container className="grid items-center gap-12 py-16 sm:py-24 md:grid-cols-2">
            <Reveal>
              <h1 className="font-display text-4xl leading-[1.08] text-ink-900 sm:text-5xl">
                Tu cuerpo se mueve mejor cuando alguien lo cuida bien.
              </h1>
              <p className="mt-6 max-w-md text-base text-ink-600">
                Sesiones de fisioterapia personalizadas, agenda tu cita en
                minutos y recibe la confirmación al instante.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button href="/reservar" size="lg">
                  Reservar cita
                </Button>
                <Button href="/servicios" size="lg" variant="secondary">
                  Ver servicios
                </Button>
              </div>

              <dl className="mt-12 flex gap-10">
                <div>
                  <dt className="font-display text-2xl text-deep-600">+500</dt>
                  <dd className="text-sm text-ink-600">sesiones realizadas</dd>
                </div>
                <div>
                  <dt className="font-display text-2xl text-deep-600">4</dt>
                  <dd className="text-sm text-ink-600">áreas de tratamiento</dd>
                </div>
                <div>
                  <dt className="font-display text-2xl text-deep-600">24/7</dt>
                  <dd className="text-sm text-ink-600">reserva en línea</dd>
                </div>
              </dl>
            </Reveal>

            <Reveal delayMs={150} className="relative mx-auto w-full max-w-md">
              <HeroMotif />
            </Reveal>
          </Container>
        </section>

        <WaveDivider fill="var(--color-white)" className="bg-mist" />

        {/* Cómo funciona */}
        <section className="bg-white py-4">
          <Container>
            <div className="grid gap-10 sm:grid-cols-3">
              <Reveal>
                <Feature
                  icon={<CalendarCheck className="text-deep-600" size={22} />}
                  title="Elige un horario"
                  text="Consulta la disponibilidad real y escoge el momento que te sirva."
                />
              </Reveal>
              <Reveal delayMs={120}>
                <Feature
                  icon={<MessageCircle className="text-deep-600" size={22} />}
                  title="Recibe confirmación"
                  text="Te avisamos por correo apenas quede agendada tu sesión."
                />
              </Reveal>
              <Reveal delayMs={240}>
                <Feature
                  icon={<ShieldCheck className="text-deep-600" size={22} />}
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
                  <div className="border-l-2 border-deep-600 bg-white p-6">
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
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100">
        {icon}
      </div>
      <p className="mt-4 font-display text-lg text-ink-900">{title}</p>
      <p className="mt-1 text-sm text-ink-600">{text}</p>
    </div>
  );
}
