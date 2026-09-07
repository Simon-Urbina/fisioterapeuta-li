import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// Shimmer button de Watermelon UI (registry.watermelon.sh), readaptado a
// la marca: fondo degradado del sitio + un destello que lo barre en
// bucle (se congela con prefers-reduced-motion vía .animate-shimmer-sweep).
// Soporta ruta interna (`to`), enlace externo (`href`) o botón.

type Common = {
  children: ReactNode;
  className?: string;
};

const shell =
  "group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full px-8 text-[15px] font-semibold text-white shadow-lg shadow-brand-700/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-brand-700/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-600 gradient-bg-pan";

const MotionLink = motion.create(Link);

function Inner({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </>
  );
}

export function ShimmerButton({
  children,
  className,
  to,
  href,
  ...rest
}: Common &
  ({ to?: string; href?: never } | { href?: string; to?: never }) &
  React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(shell, className);
  const tap = { scale: 0.96 };
  const hover = { y: -2, scale: 1.015 };
  const spring = { type: "spring" as const, stiffness: 420, damping: 18 };

  if (href) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        whileHover={hover}
        whileTap={tap}
        transition={spring}
      >
        <Inner>{children}</Inner>
      </motion.a>
    );
  }

  if (to) {
    return (
      <MotionLink
        to={to}
        className={cls}
        whileHover={hover}
        whileTap={tap}
        transition={spring}
      >
        <Inner>{children}</Inner>
      </MotionLink>
    );
  }

  return (
    <motion.button
      className={cls}
      whileHover={hover}
      whileTap={tap}
      transition={spring}
      {...(rest as HTMLMotionProps<"button">)}
    >
      <Inner>{children}</Inner>
    </motion.button>
  );
}
