import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Transición al cambiar de ruta: la vista saliente se desvanece y la
// entrante hace fade + slide corto (AnimatePresence orquesta la salida
// antes de montar la siguiente, así nunca se ven dos vistas superpuestas).
// Se remonta con key={pathname} para reproducir la animación y, de paso,
// deja el scroll arriba en cada navegación.
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (prefersReducedMotion) {
    return <div key={pathname}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 16, filter: "blur(6px)", scale: 0.992 }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
        exit={{ opacity: 0, y: -10, filter: "blur(4px)", scale: 0.996 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: "transform, filter, opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
