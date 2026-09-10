import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, MapPin, Clock, CreditCard, ArrowRight } from "lucide-react";
import { TelegramIcon } from "@/components/site/telegram-icon";
import { contacto, sedes } from "@/lib/data";

// Ventana de contacto: se superpone a la página actual con un fondo
// difuminado y aparece con animación (spring de escala + fade). Cierra
// con Escape, con clic fuera o con la X. Bloquea el scroll del fondo
// mientras está abierta y respeta prefers-reduced-motion.
export function ContactModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    prevFocus.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const t = window.setTimeout(() => closeRef.current?.focus(), 20);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      window.clearTimeout(t);
      prevFocus.current?.focus?.();
    };
  }, [open, onClose]);

  const enter = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1, y: 0 };
  const from = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.92, y: 24 };
  const leave = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, y: 12 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Fondo */}
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute inset-0 bg-brand-950/40 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            initial={from}
            animate={enter}
            exit={leave}
            transition={
              prefersReducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 260, damping: 24, mass: 0.9 }
            }
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl shadow-brand-950/25"
          >
            <div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-mist px-6 py-5">
              <div>
                <h2
                  id="contact-modal-title"
                  className="font-display text-lg font-bold text-ink-900"
                >
                  Contacto
                </h2>
                <p className="mt-0.5 text-sm text-ink-600">
                  Agenda tu cita en línea o por Telegram.
                </p>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Cerrar ventana de contacto"
                className="-mr-1.5 -mt-1 rounded-lg p-2 text-ink-600 transition-colors hover:bg-sky-100 hover:text-deep-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 px-6 py-5">
              {/* Acción principal: reservar en la web */}
              <Link
                to="/reservar"
                onClick={onClose}
                className="gradient-bg flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-white shadow-md shadow-brand-700/25 transition-transform hover:-translate-y-0.5"
              >
                <span className="font-semibold">Reservar cita en línea</span>
                <ArrowRight size={18} />
              </Link>

              {/* Telegram: abre la conversación con el bot */}
              <a
                href={contacto.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-3.5 text-deep-600 shadow-sm shadow-brand-900/5 transition-colors hover:border-deep-600 hover:bg-sky-100"
              >
                <span className="flex items-center gap-2.5">
                  <TelegramIcon size={18} />
                  <span className="font-semibold">Agendar por Telegram</span>
                </span>
                <ArrowRight size={18} />
              </a>

              <ul className="space-y-3 pt-1 text-sm">
                <li className="flex items-start gap-3">
                  <CreditCard size={16} className="mt-0.5 shrink-0 text-deep-600" />
                  <span className="text-ink-600">
                    <span className="font-medium text-ink-900">Nequi / Llave</span>
                    <br />
                    {contacto.nequi}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock size={16} className="mt-0.5 shrink-0 text-deep-600" />
                  <span className="text-ink-600">
                    <span className="font-medium text-ink-900">Horario</span>
                    <br />
                    {contacto.horarioGeneral}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-deep-600" />
                  <span className="text-ink-600">
                    <span className="font-medium text-ink-900">Sedes</span>
                    {sedes.map((s) => (
                      <span key={s.codigo} className="mt-1 block">
                        {s.nombre} — {s.ciudad}, {s.departamento}
                        <span className="block text-xs text-ink-600/80">
                          {s.nota}
                        </span>
                      </span>
                    ))}
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
