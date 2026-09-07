import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, CheckCircle2, CalendarDays, Clock, MapPin, User, Activity, Loader2 } from 'lucide-react';
import type { PropiedadesTarjetaCita } from './tarjeta-cita';

/**
 * Popup con forma de comprobante para confirmar el pago de una cita
 * pendiente desde la Agenda. Reemplaza los botones diminutos que había
 * dentro de cada bloque del calendario semanal: ahora se toca la cita y
 * sale este comprobante con el botón grande de confirmar.
 *
 * Cierra con Escape, con clic fuera o con la X. Bloquea el scroll del
 * fondo y respeta prefers-reduced-motion (mismo patrón que ContactModal).
 */
export function ModalConfirmarPago({
  cita,
  onConfirmar,
  onCancelarCita,
  onClose,
}: {
  cita: PropiedadesTarjetaCita | null;
  onConfirmar: (id: string) => void | Promise<void>;
  onCancelarCita: (id: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  const [ocupado, setOcupado] = useState<null | 'confirmar' | 'cancelar'>(null);

  const abierto = cita !== null;

  useEffect(() => {
    if (!abierto) return;
    focoPrevio.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', alTecla);
    const t = window.setTimeout(() => cerrarRef.current?.focus(), 20);

    return () => {
      document.removeEventListener('keydown', alTecla);
      document.body.style.overflow = overflow;
      window.clearTimeout(t);
      focoPrevio.current?.focus?.();
    };
  }, [abierto, onClose]);

  async function accion(tipo: 'confirmar' | 'cancelar') {
    if (!cita || ocupado) return;
    setOcupado(tipo);
    try {
      await (tipo === 'confirmar' ? onConfirmar(cita.id) : onCancelarCita(cita.id));
      onClose();
    } finally {
      setOcupado(null);
    }
  }

  const desde = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 24 };
  const entra = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 };
  const sale = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 };

  // `cita.hora` viene como "HH:MM · Sede"; se parte para mostrarlas aparte.
  const [horaTexto, sedeTexto] = (cita?.hora ?? '').split(' · ');
  const fechaLarga = cita
    ? new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date(cita.iniciaEnIso))
    : '';

  return createPortal(
    <AnimatePresence>
      {abierto && cita && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-900/50 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Comprobante de pago"
            initial={desde}
            animate={entra}
            exit={sale}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            {/* Cabecera */}
            <div className="flex items-start justify-between bg-brand-800 px-5 py-4 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                  La Fisioterapeuta Li
                </p>
                <h2 className="mt-0.5 text-base font-bold">Comprobante de pago</h2>
              </div>
              <button
                ref={cerrarRef}
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo tipo comprobante */}
            <div className="px-5 py-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
                <Fila icono={<User size={14} />} etiqueta="Paciente" valor={cita.nombrePaciente} />
                <Fila icono={<Activity size={14} />} etiqueta="Servicio" valor={cita.servicio} />
                <Fila
                  icono={<CalendarDays size={14} />}
                  etiqueta="Fecha"
                  valor={fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
                />
                <Fila icono={<Clock size={14} />} etiqueta="Hora" valor={horaTexto ?? '—'} />
                {sedeTexto && <Fila icono={<MapPin size={14} />} etiqueta="Sede" valor={sedeTexto} />}

                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-xs font-medium text-slate-500">Estado</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Pendiente de pago
                  </span>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-slate-500">
                Confirme solo cuando el comprobante de la paciente esté verificado.
                La cita quedará <span className="font-semibold text-slate-700">confirmada</span> y
                se le enviará el correo.
              </p>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                onClick={() => accion('cancelar')}
                disabled={ocupado !== null}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                {ocupado === 'cancelar' ? 'Cancelando…' : 'Cancelar cita'}
              </button>
              <button
                onClick={() => accion('confirmar')}
                disabled={ocupado !== null}
                className="ml-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {ocupado === 'confirmar' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Confirmar pago
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Fila({
  icono,
  etiqueta,
  valor,
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-sm">
      <span className="mt-0.5 shrink-0 text-slate-400">{icono}</span>
      <span className="w-20 shrink-0 text-xs font-medium text-slate-500">{etiqueta}</span>
      <span className="min-w-0 flex-1 font-medium text-slate-800">{valor}</span>
    </div>
  );
}
