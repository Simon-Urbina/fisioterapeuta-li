import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { serviciosDestacados } from "@/lib/data";

// Reemplaza la silueta: ondas concéntricas animadas (mismo motivo visual
// que WaveDivider) con una insignia que rota sola entre los servicios
// destacados. Simple, con movimiento, y sigue enlazando a /reservar.
export function HeroMotif() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % serviciosDestacados.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const activo = serviciosDestacados[index];

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center">
      <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
        <circle
          cx="200"
          cy="200"
          r="170"
          fill="none"
          stroke="var(--color-sky-100)"
          strokeWidth="2"
          className="animate-spin-slow"
          style={{ transformOrigin: "200px 200px" }}
          strokeDasharray="4 10"
        />
        <circle
          cx="200"
          cy="200"
          r="130"
          fill="var(--color-sky-100)"
          opacity="0.6"
          className="animate-float"
        />
        <circle
          cx="200"
          cy="200"
          r="92"
          fill="var(--color-sky-300)"
          opacity="0.55"
          className="animate-float"
          style={{ animationDelay: "-2.4s" }}
        />
        <circle
          cx="200"
          cy="200"
          r="54"
          fill="var(--color-deep-600)"
          opacity="0.9"
          className="animate-pulse-soft"
        />
      </svg>

      <Link
        key={activo.slug}
        to={`/reservar?servicio=${activo.slug}`}
        className="absolute bottom-2 flex items-center gap-2 rounded-full border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-deep-600 shadow-sm transition-opacity duration-500 hover:bg-sky-100 animate-fade-in"
      >
        {activo.nombre}
      </Link>
    </div>
  );
}
