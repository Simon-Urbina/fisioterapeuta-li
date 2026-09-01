import { Gift, Users, CreditCard, CalendarClock } from "lucide-react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Container } from "@/components/ui/container";
import { ServiceCatalogCard } from "@/components/site/service-catalog-card";
import { catalogo, promociones, politicas } from "@/lib/data";

export default function ServiciosPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="bg-white py-16 sm:py-20">
          <Container>
            <h1 className="font-display text-4xl text-ink-900">Servicios</h1>
            <p className="mt-3 max-w-lg text-ink-600">
              Catálogo completo de sesiones individuales, paquetes y planes
              grupales. Los precios de paquete incluyen el valor por sesión.
            </p>
          </Container>
        </section>

        {catalogo.map((cat, i) => (
          <section
            key={cat.id}
            className={i % 2 === 0 ? "bg-mist py-4" : "bg-sky-100 py-4"}
          >
            <Container className="py-12">
              <h2 className="font-display text-2xl text-ink-900">{cat.nombre}</h2>
              {cat.descripcion && (
                <p className="mt-1 text-sm text-ink-600">{cat.descripcion}</p>
              )}
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {cat.servicios.map((s) => (
                  <ServiceCatalogCard key={s.slug} servicio={s} />
                ))}
              </div>
            </Container>
          </section>
        ))}

        {/* Promociones */}
        <section className="bg-deep-600 py-16 text-white">
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
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
