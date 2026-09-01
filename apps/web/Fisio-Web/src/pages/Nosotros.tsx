import { GraduationCap, Award, Target, MapPin, Clock } from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Testimonials } from "@/components/site/testimonials";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { perfil } from "@/lib/data";

export default function NosotrosPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Presentación */}
        <section className="bg-white py-16 sm:py-20">
          <Container className="grid items-center gap-12 md:grid-cols-[auto_1fr]">
            <div className="mx-auto flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-sky-100 sm:h-48 sm:w-48">
              <span className="font-display text-5xl text-deep-600">LM</span>
            </div>
            <div>
              <p className="text-sm font-medium text-azure-500">
                {perfil.areasEnfoque.join(" · ")}
              </p>
              <h1 className="mt-2 font-display text-4xl text-ink-900">
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
            </div>
          </Container>
        </section>

        {/* Formación y certificaciones */}
        <section className="bg-sky-100 py-16">
          <Container className="grid gap-10 sm:grid-cols-2">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <GraduationCap className="text-deep-600" size={22} />
              </div>
              <h2 className="mt-4 font-display text-xl text-ink-900">
                Formación académica
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-ink-600">
                {perfil.formacion.map((f) => (
                  <li key={f} className="border-l-2 border-deep-600 pl-3">
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                <Award className="text-deep-600" size={22} />
              </div>
              <h2 className="mt-4 font-display text-xl text-ink-900">
                Diplomados y certificaciones
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-ink-600">
                {perfil.certificaciones.map((c) => (
                  <li key={c} className="border-l-2 border-deep-600 pl-3">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        {/* Áreas de enfoque */}
        <section className="bg-white py-16">
          <Container>
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
          </Container>
        </section>

        {/* Sedes y horarios */}
        <section className="bg-sky-100 py-16">
          <Container>
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
          </Container>
        </section>

        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
