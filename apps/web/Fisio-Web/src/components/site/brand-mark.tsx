import { cn } from "@/lib/utils";

// Insignia de marca reutilizada en navbar, footer y panel admin: cuadrado
// en gradiente con "Li", y opcionalmente el nombre + linea secundaria.
export function BrandMark({
  withLabel = true,
  labelClassName,
  size = "default",
  variant = "default",
}: {
  withLabel?: boolean;
  labelClassName?: string;
  size?: "default" | "sm";
  variant?: "default" | "light";
}) {
  const boxSize = size === "sm" ? "h-9 w-9 text-base" : "h-11 w-11 text-xl";
  const isLight = variant === "light";
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl font-display font-bold shadow-md shadow-brand-600/20",
          isLight ? "bg-white/15 text-white" : "gradient-bg text-white",
          boxSize
        )}
      >
        Li
      </div>
      {withLabel && (
        <div className={labelClassName}>
          <span className="block font-display text-lg font-bold leading-tight">
            {isLight ? (
              "Fisioterapeuta Li"
            ) : (
              <>
                Fisioterapeuta <span className="gradient-text">Li</span>
              </>
            )}
          </span>
          <span
            className={cn(
              "block text-[11px] font-semibold uppercase tracking-wider",
              isLight ? "text-sky-100" : "text-azure-500"
            )}
          >
            Lina Murillo · Fisioterapia &amp; Neuro
          </span>
        </div>
      )}
    </div>
  );
}
