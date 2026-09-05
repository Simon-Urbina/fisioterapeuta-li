import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, MapPin, Clock, CreditCard, Info } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/site/stepper";
import {
  servicios,
  catalogo,
  sedes,
  indicacionesPreviasPorCategoria,
  contacto,
  politicas,
  tiposDocumento,
  generos,
  epsOpciones,
  ciudadesResidencia,
  ocupaciones,
  parentescos,
  motivosConsulta,
  OTRO,
} from "@/lib/data";
import {
  slotsDisponibles,
  ocupadosEjemplo,
  sedeAtiende,
  fechaMinimaReserva,
  sumarHora,
  fechaISO,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";

const steps = ["Servicio", "Sede", "Fecha y hora", "Tus datos", "Confirmación"];

// Transición compartida entre pasos del wizard: el paso saliente se
// desliza a la izquierda mientras el entrante llega desde la derecha,
// como si avanzaras una página -- AnimatePresence orquesta que la salida
// termine antes de que el paso siguiente ocupe su lugar.
const stepMotion = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const },
};

const telefonoRegex = /^[0-9+()\s-]+$/;

const fichaSchema = z
  .object({
    // Datos básicos
    nombre: z.string().trim().min(2, "Escribe tu nombre completo").max(80, "Máximo 80 caracteres"),
    tipoDocumento: z.string().min(1, "Selecciona el tipo"),
    documento: z.string().trim().min(4, "Número no válido").max(20, "Máximo 20 caracteres"),
    fechaNacimiento: z.string().min(1, "Requerida"),
    genero: z.string().min(1, "Selecciona una opción"),
    telefono: z
      .string()
      .trim()
      .min(7, "Escribe un teléfono de contacto")
      .max(20, "Máximo 20 caracteres")
      .regex(telefonoRegex, "Solo números, espacios y + ( ) -"),
    email: z.string().trim().email("Correo no válido").max(120, "Máximo 120 caracteres"),
    // Perfil
    eps: z.string().min(1, "Selecciona tu EPS"),
    epsOtro: z.string().trim().max(60).optional(),
    ciudad: z.string().min(1, "Selecciona tu ciudad"),
    ciudadOtro: z.string().trim().max(60).optional(),
    ocupacion: z.string().min(1, "Selecciona tu ocupación"),
    ocupacionOtro: z.string().trim().max(60).optional(),
    // Contacto de emergencia
    emergenciaNombre: z.string().trim().min(2, "Requerido").max(80, "Máximo 80 caracteres"),
    emergenciaParentesco: z.string().min(1, "Selecciona el parentesco"),
    emergenciaTelefono: z
      .string()
      .trim()
      .min(7, "Escribe un teléfono")
      .max(20, "Máximo 20 caracteres")
      .regex(telefonoRegex, "Solo números, espacios y + ( ) -"),
    // Motivo
    motivo: z.string().min(1, "Selecciona un motivo"),
    motivoDetalle: z.string().trim().max(400, "Máximo 400 caracteres").optional(),
    referido: z.string().trim().max(80, "Máximo 80 caracteres").optional(),
    notas: z.string().trim().max(300, "Máximo 300 caracteres").optional(),
    // Honeypot anti-bots
    empresa: z.string().max(0, "").optional(),
  })
  .superRefine((val, ctx) => {
    if (val.eps === OTRO && !val.epsOtro)
      ctx.addIssue({ path: ["epsOtro"], code: "custom", message: "Especifica tu EPS" });
    if (val.ciudad === OTRO && !val.ciudadOtro)
      ctx.addIssue({ path: ["ciudadOtro"], code: "custom", message: "Especifica tu ciudad" });
    if (val.ocupacion === OTRO && !val.ocupacionOtro)
      ctx.addIssue({ path: ["ocupacionOtro"], code: "custom", message: "Especifica tu ocupación" });
  });

type FichaForm = z.infer<typeof fichaSchema>;

function edadDesde(fechaNacimiento: string): number | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento + "T00:00:00");
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 && edad < 120 ? edad : null;
}

function categoriaDeSlug(slug: string) {
  return catalogo.find((c) => c.servicios.some((s) => s.slug === slug));
}

export function ReservaWizard() {
  const [params] = useSearchParams();
  const preselected = params.get("servicio");

  const [step, setStep] = useState(0);
  const [servicioSlug, setServicioSlug] = useState(preselected ?? "");
  const [sedeCodigo, setSedeCodigo] = useState("");
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState<string>("");
  const [enviado, setEnviado] = useState(false);
  const [referencia, setReferencia] = useState("");

  const servicio = servicios.find((s) => s.slug === servicioSlug);
  const categoria = servicioSlug ? categoriaDeSlug(servicioSlug) : undefined;
  const minFecha = useMemo(() => fechaMinimaReserva(), []);

  const horas = useMemo(() => {
    if (!fecha || !servicio || !sedeCodigo) return [];
    return slotsDisponibles(
      servicio,
      sedeCodigo,
      fecha,
      ocupadosEjemplo(fecha, sedeCodigo)
    );
  }, [fecha, servicio, sedeCodigo]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FichaForm>({ resolver: zodResolver(fichaSchema) });

  const epsSel = watch("eps");
  const ciudadSel = watch("ciudad");
  const ocupacionSel = watch("ocupacion");
  const edad = edadDesde(watch("fechaNacimiento") ?? "");

  function goNext() {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function onConfirmar(data: FichaForm) {
    if (data.empresa) return; // honeypot: bot -> descartar
    const ref = `FISIO-${Date.now().toString(36).toUpperCase()}`;
    // Payload que consumirá el backend / n8n.
    console.log("Reserva enviada:", {
      referencia: ref,
      servicioSlug,
      servicioNombre: servicio?.nombre,
      sede: sedeCodigo,
      fecha: fecha ? fechaISO(fecha) : undefined,
      hora,
      duracionMin: servicio?.duracionMin,
      paciente: {
        ...data,
        edad,
        eps: data.eps === OTRO ? data.epsOtro : data.eps,
        ciudad: data.ciudad === OTRO ? data.ciudadOtro : data.ciudad,
        ocupacion: data.ocupacion === OTRO ? data.ocupacionOtro : data.ocupacion,
      },
    });
    setReferencia(ref);
    setEnviado(true);
    goNext();
  }

  return (
    <Container className="max-w-2xl">
      <span className="eyebrow">
        <span className="h-1.5 w-1.5 rounded-full gradient-bg" />
        Agenda en línea
      </span>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
        Reservar cita
      </h1>
      <p className="mt-2 text-lg text-ink-600">
        Cinco pasos rápidos y quedas agendado.
      </p>

      <div className="mt-10">
        <Stepper steps={steps} current={step} />
      </div>

      <div className="card mt-10 overflow-hidden p-6 sm:p-8">
       <AnimatePresence mode="wait" initial={false}>
        {/* Paso 0 — Servicio */}
        {step === 0 && (
          <motion.div key="step-0" {...stepMotion}>
            <p className="font-display text-xl font-bold text-ink-900">
              ¿Qué sesión necesitas?
            </p>
            <div className="mt-6 grid gap-3">
              {servicios.map((s) => (
                <label
                  key={s.slug}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all",
                    servicioSlug === s.slug
                      ? "border-deep-600 bg-sky-100 ring-2 ring-inset ring-deep-600/20"
                      : "border-sky-300 hover:border-deep-600 hover:bg-mist"
                  )}
                >
                  <span>
                    <span className="block font-semibold text-ink-900">
                      {s.nombre}
                    </span>
                    <span className="block text-sm text-ink-600">
                      {s.duracionMin} minutos
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="servicio"
                    className="h-4 w-4 accent-[var(--color-deep-600)]"
                    checked={servicioSlug === s.slug}
                    onChange={() => setServicioSlug(s.slug)}
                  />
                </label>
              ))}
            </div>
            <div className="mt-8 flex justify-end">
              <Button disabled={!servicioSlug} onClick={goNext}>
                Continuar
              </Button>
            </div>
          </motion.div>
        )}

        {/* Paso 1 — Sede */}
        {step === 1 && (
          <motion.div key="step-1" {...stepMotion}>
            <p className="font-display text-xl font-bold text-ink-900">
              ¿En qué sede te atendemos?
            </p>
            <p className="mt-1 text-sm text-ink-600">
              La disponibilidad depende de la sede: cada una atiende días
              distintos.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {sedes.map((s) => (
                <label
                  key={s.codigo}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-xl border p-4 transition-all",
                    sedeCodigo === s.codigo
                      ? "border-deep-600 bg-sky-100 ring-2 ring-inset ring-deep-600/20"
                      : "border-sky-300 hover:border-deep-600 hover:bg-mist"
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-ink-900">
                      <MapPin size={16} className="text-deep-600" />
                      {s.nombre}
                    </span>
                    <input
                      type="radio"
                      name="sede"
                      className="h-4 w-4 accent-[var(--color-deep-600)]"
                      checked={sedeCodigo === s.codigo}
                      onChange={() => {
                        setSedeCodigo(s.codigo);
                        setFecha(undefined);
                        setHora("");
                      }}
                    />
                  </span>
                  <span className="mt-1 text-sm text-ink-600">
                    {s.ciudad}, {s.departamento}
                  </span>
                  <span className="mt-2 text-xs font-medium text-azure-500">
                    {s.nota}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={goBack}>
                Atrás
              </Button>
              <Button disabled={!sedeCodigo} onClick={goNext}>
                Continuar
              </Button>
            </div>
          </motion.div>
        )}

        {/* Paso 2 — Fecha y hora */}
        {step === 2 && (
          <motion.div key="step-2" {...stepMotion}>
            <p className="font-display text-xl font-bold text-ink-900">
              Elige fecha y hora
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
              <Clock size={14} />
              Se requieren mínimo 24 horas de anticipación. Almuerzo 12:00–14:00.
            </p>
            <div className="mt-6 flex flex-col gap-8 sm:flex-row">
              <DayPicker
                mode="single"
                selected={fecha}
                onSelect={(d) => {
                  setFecha(d);
                  setHora("");
                }}
                disabled={[
                  { before: minFecha },
                  (d: Date) => !sedeAtiende(sedeCodigo, d),
                ]}
                className="rdp-fisio"
              />
              <div className="flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  {!fecha && (
                    <motion.p
                      key="sin-fecha"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm text-ink-600"
                    >
                      Selecciona un día habilitado para ver los horarios
                      disponibles.
                    </motion.p>
                  )}
                  {fecha && horas.length === 0 && (
                    <motion.p
                      key="sin-cupos"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="text-sm text-ink-600"
                    >
                      No hay cupos disponibles ese día. Prueba otra fecha.
                    </motion.p>
                  )}
                  {fecha && horas.length > 0 && (
                    <motion.div
                      key="horarios"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="mb-3 text-sm font-medium text-ink-900">
                        Horarios disponibles
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {horas.map((h) => (
                          <motion.button
                            key={h}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => setHora(h)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                              hora === h
                                ? "border-deep-600 bg-deep-600 text-white shadow-sm shadow-brand-700/20"
                                : "border-sky-300 text-ink-900 hover:border-deep-600 hover:bg-sky-100"
                            )}
                          >
                            {h}
                          </motion.button>
                        ))}
                      </div>
                      {hora && servicio && (
                        <p className="mt-3 text-xs text-ink-600">
                          Duración ~{servicio.duracionMin} min · termina{" "}
                          {sumarHora(hora, servicio.duracionMin)}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={goBack}>
                Atrás
              </Button>
              <Button disabled={!fecha || !hora} onClick={goNext}>
                Continuar
              </Button>
            </div>
          </motion.div>
        )}

        {/* Paso 3 — Tus datos (ficha ampliada) */}
        {step === 3 && (
          <motion.form key="step-3" {...stepMotion} onSubmit={handleSubmit(onConfirmar)}>
            <input
              type="text"
              {...register("empresa")}
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />
            <p className="font-display text-xl font-bold text-ink-900">Tus datos</p>
            <p className="mt-1 text-sm text-ink-600">
              Con esta información abrimos tu ficha. Solo la usamos para tu
              atención.
            </p>

            <Grupo titulo="Datos básicos">
              <Field label="Nombre completo" error={errors.nombre?.message}>
                <input
                  {...register("nombre")}
                  autoComplete="name"
                  maxLength={80}
                  className="fisio-input"
                  placeholder="Ana Torres"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
                <SelectField
                  label="Tipo de doc."
                  error={errors.tipoDocumento?.message}
                  {...register("tipoDocumento")}
                >
                  <option value="">—</option>
                  {tiposDocumento.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </SelectField>
                <Field label="Número de documento" error={errors.documento?.message}>
                  <input
                    {...register("documento")}
                    inputMode="numeric"
                    maxLength={20}
                    className="fisio-input"
                    placeholder="1052884331"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={`Fecha de nacimiento${edad != null ? ` · ${edad} años` : ""}`}
                  error={errors.fechaNacimiento?.message}
                >
                  <input
                    {...register("fechaNacimiento")}
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    className="fisio-input"
                  />
                </Field>
                <SelectField
                  label="Género"
                  error={errors.genero?.message}
                  {...register("genero")}
                >
                  <option value="">Selecciona</option>
                  {generos.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Teléfono / WhatsApp" error={errors.telefono?.message}>
                  <input
                    {...register("telefono")}
                    type="tel"
                    autoComplete="tel"
                    maxLength={20}
                    className="fisio-input"
                    placeholder="300 000 0000"
                  />
                </Field>
                <Field label="Correo" error={errors.email?.message}>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    maxLength={120}
                    className="fisio-input"
                    placeholder="ana@correo.com"
                  />
                </Field>
              </div>
            </Grupo>

            <Grupo titulo="Perfil">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="EPS / Aseguradora" error={errors.eps?.message} {...register("eps")}>
                  <option value="">Selecciona</option>
                  {epsOpciones.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </SelectField>
                {epsSel === OTRO && (
                  <Field label="¿Cuál EPS?" error={errors.epsOtro?.message}>
                    <input {...register("epsOtro")} maxLength={60} className="fisio-input" />
                  </Field>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Ciudad de residencia"
                  error={errors.ciudad?.message}
                  {...register("ciudad")}
                >
                  <option value="">Selecciona</option>
                  {ciudadesResidencia.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </SelectField>
                {ciudadSel === OTRO && (
                  <Field label="¿Cuál ciudad?" error={errors.ciudadOtro?.message}>
                    <input {...register("ciudadOtro")} maxLength={60} className="fisio-input" />
                  </Field>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Ocupación / Perfil"
                  error={errors.ocupacion?.message}
                  {...register("ocupacion")}
                >
                  <option value="">Selecciona</option>
                  {ocupaciones.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </SelectField>
                {ocupacionSel === OTRO && (
                  <Field label="¿Cuál ocupación?" error={errors.ocupacionOtro?.message}>
                    <input {...register("ocupacionOtro")} maxLength={60} className="fisio-input" />
                  </Field>
                )}
              </div>
            </Grupo>

            <Grupo titulo="Contacto de emergencia">
              <Field label="Nombre" error={errors.emergenciaNombre?.message}>
                <input
                  {...register("emergenciaNombre")}
                  maxLength={80}
                  className="fisio-input"
                  placeholder="Pedro Torres"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Parentesco"
                  error={errors.emergenciaParentesco?.message}
                  {...register("emergenciaParentesco")}
                >
                  <option value="">Selecciona</option>
                  {parentescos.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </SelectField>
                <Field label="Teléfono" error={errors.emergenciaTelefono?.message}>
                  <input
                    {...register("emergenciaTelefono")}
                    type="tel"
                    maxLength={20}
                    className="fisio-input"
                    placeholder="300 000 0000"
                  />
                </Field>
              </div>
            </Grupo>

            <Grupo titulo="Motivo de la consulta">
              <SelectField label="Motivo principal" error={errors.motivo?.message} {...register("motivo")}>
                <option value="">Selecciona</option>
                {motivosConsulta.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </SelectField>
              <Field label="Cuéntanos brevemente (opcional)" error={errors.motivoDetalle?.message}>
                <textarea
                  {...register("motivoDetalle")}
                  maxLength={400}
                  className="fisio-input min-h-20"
                  placeholder="Desde cuándo, qué lo desencadenó, tratamientos previos…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="¿Quién te refirió? (opcional)" error={errors.referido?.message}>
                  <input {...register("referido")} maxLength={80} className="fisio-input" />
                </Field>
                <Field label="Notas (opcional)" error={errors.notas?.message}>
                  <input
                    {...register("notas")}
                    maxLength={300}
                    className="fisio-input"
                    placeholder="Algo que debamos saber antes"
                  />
                </Field>
              </div>
            </Grupo>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-sky-300 bg-sky-100 p-4 text-sm text-ink-600">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-deep-600" />
              <p>
                <strong className="text-ink-900">{servicio?.nombre}</strong> ·{" "}
                {sedes.find((s) => s.codigo === sedeCodigo)?.nombre} —{" "}
                {fecha?.toLocaleDateString("es-CO", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                a las {hora}
              </p>
            </div>

            <div className="mt-8 flex justify-between">
              <Button type="button" variant="ghost" onClick={goBack}>
                Atrás
              </Button>
              <Button type="submit">Confirmar reserva</Button>
            </div>
          </motion.form>
        )}

        {/* Paso 4 — Confirmación */}
        {step === 4 && enviado && (
          <motion.div key="step-4" {...stepMotion} className="py-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
              <CheckCircle2 className="text-deep-600" size={36} />
            </div>
            <p className="mt-4 font-display text-2xl font-bold text-ink-900">
              ¡Solicitud enviada!
            </p>
            <p className="mx-auto mt-2 max-w-md text-ink-600">
              Recibimos tu solicitud de{" "}
              <strong className="text-ink-900">
                {servicio?.nombre.toLowerCase()}
              </strong>{" "}
              en {sedes.find((s) => s.codigo === sedeCodigo)?.nombre}. Te
              confirmamos por correo apenas quede agendada.
            </p>
            <p className="mt-3 inline-block rounded-full bg-mist px-4 py-1.5 text-sm font-semibold text-deep-600">
              Referencia {referencia}
            </p>

            <div className="mt-8 space-y-4 text-left">
              {categoria && (
                <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-white p-4">
                  <Info size={18} className="mt-0.5 shrink-0 text-deep-600" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      Antes de tu sesión
                    </p>
                    <p className="mt-1 text-sm text-ink-600">
                      {indicacionesPreviasPorCategoria[categoria.id]}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 rounded-xl border border-sky-300 bg-sky-100 p-4">
                <CreditCard size={18} className="mt-0.5 shrink-0 text-deep-600" />
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    Pago 100% por adelantado
                  </p>
                  <p className="mt-1 text-sm text-ink-600">
                    {politicas.reserva} Puedes pagar por Nequi / Llave:{" "}
                    <strong className="text-ink-900">{contacto.nequi}</strong>, o
                    en efectivo. {politicas.reagendamiento}
                  </p>
                </div>
              </div>
            </div>

            <Button href="/" className="mt-8">
              Volver al inicio
            </Button>
          </motion.div>
        )}
       </AnimatePresence>
      </div>
    </Container>
  );
}

function Grupo({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mt-6 border-t border-sky-100 pt-5">
      <legend className="text-xs font-bold uppercase tracking-wider text-deep-600">
        {titulo}
      </legend>
      <div className="mt-3 grid gap-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-900">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const SelectField = ({
  label,
  error,
  children,
  ref,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  ref?: React.Ref<HTMLSelectElement>;
}) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-ink-900">{label}</span>
    <select ref={ref} className="fisio-input bg-white" {...props}>
      {children}
    </select>
    {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
  </label>
);
