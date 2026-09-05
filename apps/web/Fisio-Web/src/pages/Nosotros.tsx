import { Target, MapPin, Clock, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Testimonials } from "@/components/site/testimonials";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
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

const areasShowcase = [
  {
    area: "Neurorrehabilitación",
    image: "/images/area-neurorrehabilitacion.jpg",
    alt: "Sesión de neurorrehabilitación con paciente pediátrico",
    texto:
      "Estimulación motora y funcional para pacientes con compromiso neurológico, incluida atención pediátrica.",
  },
  {
    area: "Rehabilitación Deportiva",
    image: "/images/area-deportiva.jpg",
    alt: "Atención de fisioterapia deportiva durante un evento de running",
    texto:
      "Recuperación y prevención de lesiones para deportistas, dentro y fuera del consultorio.",
  },
];

export default function NosotrosPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Presentación */}
        <section className="relative overflow-hidden bg-white">
          <div className="dot-grid pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-brand-400/10 blur-[130px]" />
          <Container className="section-sm relative grid items-center gap-12 md:grid-cols-[auto_1fr]">
            <Reveal>
              <div className="relative mx-auto w-fit">
                <div className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-br from-sky-300/40 to-transparent blur-xl" />
                <AvatarPhoto
                  src="/images/FOTOS/Lina.png"
                  initials="LM"
                  alt={perfil.nombreCompleto}
                  className="relative h-44 w-44 shrink-0 border-4 border-white object-[center_20%] shadow-xl shadow-brand-900/15 sm:h-52 sm:w-52"
                />
              </div>
            </Reveal>
            <Reveal delayMs={120}>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-white/80 px-4 py-1.5 text-xs font-semibold text-deep-600 backdrop-blur">
                <span className="h-2 w-2 rounded-full gradient-bg" />
                {perfil.areasEnfoque.join(" · ")}
              </span>
              <h1 className="gradient-text mt-4 font-display text-4xl font-extrabold leading-[1.1] sm:text-5xl">
                {perfil.nombreProfesional}
              </h1>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-azure-500">
                {perfil.nombreCompleto}
              </p>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
                Fisioterapeuta enfocada en neurorrehabilitación y
                rehabilitación deportiva, combinando terapia manual,
                ejercicio terapéutico y técnicas complementarias para
                acompañar el proceso de recuperación de cada paciente.
              </p>
              <Button href="/reservar" className="mt-7">
                Reservar cita
              </Button>
            </Reveal>
          </Container>
        </section>

        {/* Formación y certificaciones -- tarjetas numeradas */}
        <section className="bg-sky-100">
          <Container className="section-sm">
            <Reveal>
              <SectionHeading
                eyebrow="Formación & certificaciones"
                title="Respaldo académico"
                titleClassName="text-2xl sm:text-[1.75rem]"
              />
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {credenciales.map((c, i) => (
                <Reveal key={c.titulo} delayMs={i * 80}>
                  <motion.div
                    whileHover={{ y: -6, scale: 1.015 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="card h-full p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 font-display text-sm font-bold text-deep-600">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <GraduationCap size={18} className="text-sky-300" />
                    </div>
                    <h3 className="mt-4 font-display text-base font-bold text-ink-900">
                      {c.titulo}
                    </h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-azure-500">
                      {c.tipo}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">
                      {c.texto}
                    </p>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Áreas de enfoque */}
        <section className="bg-white">
          <Container className="section-sm">
            <Reveal>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100">
                <Target className="text-deep-600" size={22} />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-ink-900">
                Áreas de enfoque principal
              </h2>
            </Reveal>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {areasShowcase.map((a, i) => (
                <Reveal
                  key={a.area}
                  variant={i % 2 === 0 ? "left" : "right"}
                  delayMs={i * 100}
                >
                  <div className="group relative h-64 overflow-hidden rounded-3xl border border-sky-100 shadow-lg shadow-brand-900/10 sm:h-72">
                    <img
                      src={a.image}
                      alt={a.alt}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-deep-700/80 via-deep-700/10 to-transparent" />
                    <div className="absolute inset-x-5 bottom-5 text-white">
                      <p className="font-display text-lg font-bold">{a.area}</p>
                      <p className="mt-1 text-sm leading-relaxed text-sky-100">
                        {a.texto}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Sedes y horarios */}
        <section className="bg-sky-100">
          <Container className="section-sm">
            <Reveal>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
                <MapPin className="text-deep-600" size={22} />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-ink-900">
                Sedes y horarios
              </h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {perfil.sedes.map((s) => (
                  <motion.div
                    key={s.nombre}
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="card p-6"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-azure-500" />
                      <p className="font-display font-bold text-ink-900">
                        {s.nombre}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">
                      {s.horario}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-3 card p-6">
                <Clock className="mt-0.5 shrink-0 text-deep-600" size={20} />
                <p className="text-sm leading-relaxed text-ink-600">
                  {perfil.horarioGeneral}
                </p>
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
