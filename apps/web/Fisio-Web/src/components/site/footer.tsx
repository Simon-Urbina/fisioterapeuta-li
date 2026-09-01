import { Link } from "react-router-dom";
import { Container } from "@/components/ui/container";

export function Footer() {
  return (
    <footer id="contacto" className="gradient-bg mt-auto text-white">
      <Container className="grid gap-10 py-14 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 font-display text-sm font-bold">
              Li
            </div>
            <p className="font-display text-lg">Fisioterapeuta Li</p>
          </div>
          <p className="mt-3 max-w-xs text-sm text-sky-100">
            Sesiones de fisioterapia personalizadas para recuperar tu
            movimiento, a tu ritmo.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-sky-100">Contacto</p>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li>hola@fisioterapeutali.com</li>
            <li>+57 300 000 0000</li>
            <li>Bogotá, Colombia</li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-sky-100">Enlaces</p>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li>
              <Link to="/servicios" className="hover:text-white">
                Servicios
              </Link>
            </li>
            <li>
              <Link to="/resenas" className="hover:text-white">
                Reseñas
              </Link>
            </li>
            <li>
              <Link to="/reservar" className="hover:text-white">
                Reservar cita
              </Link>
            </li>
            <li>
              <Link to="/admin/login" className="hover:text-white">
                Acceso administrativo
              </Link>
            </li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-white/10 py-5 text-center text-xs text-sky-100/80">
        © {new Date().getFullYear()} Fisioterapeuta Li — HackTech 5.0
      </div>
    </footer>
  );
}
