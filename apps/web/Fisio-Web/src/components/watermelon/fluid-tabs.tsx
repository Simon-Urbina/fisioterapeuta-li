import type { ReactNode, FC } from "react";
import { motion, useReducedMotion } from "motion/react";

// Tabs "fluidas" de Watermelon UI (registry.watermelon.sh), readaptadas
// a la paleta del sitio: pastilla activa flotante con layoutId + ligero
// desenfoque y escala del icono al cambiar. Sirve para mostrar una
// categoría a la vez en vez de apilar varias rejillas.

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface FluidTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export const FluidTabs: FC<FluidTabsProps> = ({
  tabs,
  active,
  onChange,
  className = "",
}) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`relative flex flex-wrap items-center gap-1 rounded-full border border-sky-100 bg-sky-100/70 p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="group relative rounded-full px-3 py-2 outline-none sm:px-4 sm:py-2.5"
          >
            {isActive && (
              <motion.div
                layoutId="fluid-tab-pill"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 280, damping: 25, mass: 0.8 }
                }
                className="absolute inset-0 rounded-full border border-sky-300 bg-white shadow-sm shadow-brand-900/5"
              />
            )}

            <motion.span
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      filter: isActive
                        ? ["blur(0px)", "blur(3px)", "blur(0px)"]
                        : "blur(0px)",
                    }
              }
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`relative z-10 flex items-center gap-1.5 text-sm tracking-tight whitespace-nowrap transition-colors sm:gap-2 ${
                isActive
                  ? "font-bold text-deep-700"
                  : "font-semibold text-ink-600 group-hover:text-deep-600"
              }`}
            >
              {tab.icon && (
                <motion.span
                  animate={{ scale: isActive ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="flex shrink-0 items-center justify-center"
                >
                  {tab.icon}
                </motion.span>
              )}
              {tab.label}
            </motion.span>
          </button>
        );
      })}
    </div>
  );
};
