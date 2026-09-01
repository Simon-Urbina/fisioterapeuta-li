import { Target, MapPin, Clock } from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Testimonials } from "@/components/site/testimonials";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AvatarPhoto } from "@/components/ui/avatar-photo";
import { perfil } from "@/lib/data";

const credenciales = [
  { titulo: "Universidad de Boyacá", tipo: "Pregrado", texto: perfil.formacion[0] },
  { titulo: "Univ. Autónoma de Manizales", tipo: "Especialización y maestría", texto: perfil.formacion[1] },
  { titulo: "CAAFYR", tipo: "Certificación", texto: perfil.certificaciones[1] },
  { titulo: "CRAPTICA", tipo: "Diplomado internacional", texto: perfil.certificaciones[2] },
  { titulo: "Fisioterapia en Movimiento", tipo: "Diplomado", texto: perfil.certificaciones[0] },
];

export default function NosotrosPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Presentación */}
        <section className="relative overflow-hidden bg-white py-16 sm:py-20">
          <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-brand-400/10 blur-[120px]" />
          <Container className="relative grid items-center gap-12 md:grid-cols-[auto_1fr]">
            <Reveal>
              <AvatarPhoto
                src="/images/lina-perfil.jpg"
                initials="LM"
                alt={perfil.nombreCompleto}
                className="mx-auto h-40 w-40 shrink-0 sm:h-48 sm:w-48"
              />
            </Reveal>
            <Reveal delayMs={120}>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white px-4 py-1.5 text-xs font-semibold text-deep-600">
                <span className="h-2 w-2 rounded-full gradient-bg" />
                {perfil.areasEnfoque.join(" · ")}
              </span>
              <h1 className="gradient-text mt-3 font-display text-4xl font-extrabold text-ink-900">
                {perfil.nombreProfesional}
              </h1>
              <p className="mt-1 text-ink-600">{perfil.nombreCompleto}</p>
              <p className="mt-5 max-w-xl text-ink-600">
                Fisioterapeuta enfocada en neurorrehabilitación y
                rehabilitación deportiva, combinando terapia manual,
                ejercicio terapéutico y técnicas complementarias para
                acompañar el proceso de recuperación de cada paciente.
              </p>
              <Button href="/reservar" className="mt-6">
                Reservar cita
              </Button>
            </Reveal>
          </Container>
        </section>

        {/* Formación y certificaciones -- tarjetas numeradas */}
        <section className="bg-sky-100 py-16">
          <Container>
            <Reveal>
              <span className="text-xs font-bold uppercase tracking-wider text-deep-600">
                Formación &amp; certificaciones
              </span>
              <h2 className="mt-1 font-display text-2xl text-ink-900">
                Respaldo académico
              </h2>
            </Reveal>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {credenciales.map((c, i) => (
                <Reveal key={c.titulo} delayMs={i * 80}>
                  <div className="h-full rounded-2xl border border-transparent bg-white p-6 shadow-sm shadow-brand-900/5 transition-colors hover:border-sky-300">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 font-display text-sm font-bold text-deep-600">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <h3 className="mt-4 font-display text-base font-bold text-ink-900">
                      {c.titulo}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-azure-500">{c.tipo}</p>
                    <p className="mt-2 text-xs text-ink-600">{c.texto}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Áreas de enfoque */}
        <section className="bg-white py-16">
          <Container>
            <Reveal>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100">
                <Target className="text-deep-600" size={22} />
              </div>
              <h2 className="mt-4 font-display text-xl text-ink-900">
                Áreas de enfoque principal
              </h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {perfil.areasEnfoque.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border border-sky-300 px-4 py-1.5 text-sm text-deep-600"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </Reveal>
          </Container>
        </section>

        {/* Sedes y horarios */}
        <section className="bg-sky-100 py-16">
          <Container>
            <Reveal>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <MapPin className="text-deep-600" size={22} />
              </div>
              <h2 className="mt-4 font-display text-xl text-ink-900">
                Sedes y horarios
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {perfil.sedes.map((s) => (
                  <div key={s.nombre} className="rounded-2xl bg-white p-6">
                    <p className="font-medium text-ink-900">{s.nombre}</p>
                    <p className="mt-1 text-sm text-ink-600">{s.horario}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white p-6">
                <Clock className="mt-0.5 shrink-0 text-deep-600" size={20} />
                <p className="text-sm text-ink-600">{perfil.horarioGeneral}</p>
              </div>
            </Reveal>
          </Container>
        </section>

        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
