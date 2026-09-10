import { useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";

// Tarjeta con inclinación 3D sutil hacia el puntero + brillo radial que
// lo sigue (escribe --mx / --my para la utilidad .spotlight del CSS).
// Con prefers-reduced-motion se comporta como un div normal.
export function TiltCard({
  children,
  className,
  max = 6,
  spotlight = true,
}: {
  children: ReactNode;
  className?: string;
  /** inclinación máxima en grados */
  max?: number;
  spotlight?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 220, damping: 20, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 220, damping: 20, mass: 0.6 });
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);

  if (prefersReducedMotion) {
    return <div className={cn(spotlight && "spotlight", className)}>{children}</div>;
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    px.set(x);
    py.set(y);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  }

  function handleLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={cn(
        "[transform-style:preserve-3d] will-change-transform",
        spotlight && "spotlight",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
