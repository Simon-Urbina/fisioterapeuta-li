import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { serviciosDestacados } from "@/lib/data";
import { useParallax } from "@/lib/use-parallax";

// Motif del hero: un blob orgánico que muta su silueta, un anillo punteado
// que gira con un punto en órbita, y motas que flotan a distinto ritmo.
// Encima, una insignia que rota entre los servicios destacados y enlaza a
// /reservar. Mezclar CSS + SVG con movimiento asíncrono evita el look
// "tres círculos concéntricos perfectos" de plantilla generada.
export function HeroMotif() {
  const [index, setIndex] = useState(0);
  const parallax = useParallax<HTMLDivElement>(0.08);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % serviciosDestacados.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const activo = serviciosDestacados[index];

  return (
    <div
      ref={parallax}
      className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center"
    >
      {/* Blob orgánico que muta */}
      <div className="animate-blob animate-float-lg absolute h-[78%] w-[78%] gradient-bg opacity-90 blur-[1px]" />
      <div
        className="animate-blob absolute h-[62%] w-[62%] bg-sky-300/60"
        style={{ animationDelay: "-6s", animationDuration: "20s" }}
      />

      {/* Anillo punteado que gira + punto en órbita */}
      <svg viewBox="0 0 400 400" className="absolute h-full w-full" aria-hidden>
        <circle
          cx="200"
          cy="200"
          r="176"
          fill="none"
          stroke="var(--color-sky-300)"
          strokeWidth="2"
          strokeDasharray="2 12"
          className="animate-spin-slow"
          style={{ transformOrigin: "200px 200px" }}
        />
      </svg>
      <div className="animate-orbit absolute h-full w-full">
        <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-brand-400 shadow-[0_0_12px_2px_var(--color-brand-300)]" />
      </div>

      {/* Motas flotando, fuera de fase */}
      <span className="animate-float absolute left-[12%] top-[22%] h-2.5 w-2.5 rounded-full bg-white/80" />
      <span
        className="animate-float-lg absolute right-[14%] top-[30%] h-2 w-2 rounded-full bg-brand-200"
        style={{ animationDelay: "-3s" }}
      />
      <span
        className="animate-float absolute bottom-[26%] right-[20%] h-1.5 w-1.5 rounded-full bg-white/70"
        style={{ animationDelay: "-1.5s" }}
      />

      {/* Insignia rotativa de servicio */}
      <Link
        key={activo.slug}
        to={`/reservar?servicio=${activo.slug}`}
        className="animate-fade-in absolute bottom-2 flex items-center gap-2 rounded-full border border-sky-300 bg-white/95 px-4 py-2 text-sm font-semibold text-deep-600 shadow-lg shadow-brand-900/10 backdrop-blur transition-transform duration-300 hover:-translate-y-0.5 hover:bg-white"
      >
        <span className="h-2 w-2 rounded-full gradient-bg" />
        {activo.nombre}
      </Link>
    </div>
  );
}
