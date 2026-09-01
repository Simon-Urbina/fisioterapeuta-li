import { Link } from "react-router-dom";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-screen sm:grid-cols-2">
      <section className="hidden flex-col justify-between bg-deep-600 p-10 text-white sm:flex">
        <Link to="/" className="font-display text-lg">
          Fisioterapeuta Li
        </Link>
        <div>
          <p className="font-display text-3xl leading-tight">
            Toda tu agenda, tus clientes y tus servicios en un solo lugar.
          </p>
          <p className="mt-4 max-w-sm text-sm text-sky-100">
            Panel administrativo — solo para el equipo de Fisioterapeuta Li.
          </p>
        </div>
        <p className="text-xs text-sky-100/70">HackTech 5.0 · Reto 3</p>
      </section>

      <section className="flex items-center justify-center bg-white p-8">
        <Container className="max-w-sm px-0">
          <h1 className="font-display text-2xl text-ink-900">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Ingresa con tu cuenta administrativa.
          </p>

          <form className="mt-8 grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-900">
                Correo
              </span>
              <input
                type="email"
                className="fisio-input"
                placeholder="admin@fisioterapeutali.com"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-900">
                Contraseña
              </span>
              <input
                type="password"
                className="fisio-input"
                placeholder="••••••••"
              />
            </label>

            <Button href="/admin/agenda" className="mt-2 w-full">
              Entrar
            </Button>
          </form>

          <Link
            to="/"
            className="mt-8 block text-center text-sm text-ink-600 hover:text-deep-600"
          >
            ← Volver al sitio
          </Link>
        </Container>
      </section>
    </main>
  );
}
