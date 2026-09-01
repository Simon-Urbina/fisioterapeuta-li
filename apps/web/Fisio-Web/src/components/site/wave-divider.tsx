// Motivo recurrente del sitio: una onda que representa movimiento y
// recuperación. Se reutiliza (con variaciones de color) entre secciones
// clave en lugar de usar una forma distinta y arbitraria en cada una.
export function WaveDivider({
  flip = false,
  fill = "var(--color-white)",
  className = "",
}: {
  flip?: boolean;
  fill?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`w-full overflow-hidden leading-[0] ${flip ? "rotate-180" : ""} ${className}`}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="h-16 w-full sm:h-24"
      >
        <path
          d="M0,64 C240,120 480,0 720,32 C960,64 1200,112 1440,56 L1440,120 L0,120 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}
