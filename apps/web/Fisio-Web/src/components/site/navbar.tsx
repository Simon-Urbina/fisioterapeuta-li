
import { Link } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { BrandMark } from "@/components/site/brand-mark";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/servicios", label: "Servicios" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/resenas", label: "Reseñas" },
  { href: "/#contacto", label: "Contacto" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass-nav sticky top-1 z-40 border-b border-sky-100 bg-white/90 shadow-sm shadow-brand-900/5">
      <Container className="flex h-20 items-center justify-between">
        <Link to="/" className="text-ink-900">
          <BrandMark />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className="text-sm font-medium text-ink-600 transition-colors hover:text-deep-600"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button href="/reservar" size="sm">
            Reservar cita
          </Button>
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </Container>

      {open && (
        <div className="border-t border-sky-100 bg-white md:hidden">
          <Container className="flex flex-col gap-4 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className="text-sm text-ink-600"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Button href="/reservar" size="sm" className="w-full">
              Reservar cita
            </Button>
          </Container>
        </div>
      )}
    </header>
  );
}
