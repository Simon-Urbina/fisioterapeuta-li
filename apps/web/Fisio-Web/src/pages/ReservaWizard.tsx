
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/site/stepper";
import { servicios, horariosDisponibles } from "@/lib/data";
import { cn } from "@/lib/utils";

const steps = ["Servicio", "Fecha y hora", "Tus datos", "Confirmación"];

const contactoSchema = z.object({
  nombre: z.string().min(2, "Escribe tu nombre completo"),
  email: z.string().email("Correo no válido"),
  telefono: z.string().min(7, "Escribe un teléfono de contacto"),
  notas: z.string().optional(),
});

type ContactoForm = z.infer<typeof contactoSchema>;

export function ReservaWizard() {
  const [params] = useSearchParams();
  const preselected = params.get("servicio");

  const [step, setStep] = useState(0);
  const [servicioSlug, setServicioSlug] = useState(preselected ?? "");
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState<string>("");
  const [enviado, setEnviado] = useState(false);

  const servicio = servicios.find((s) => s.slug === servicioSlug);
  const horas = useMemo(() => (fecha ? horariosDisponibles(fecha) : []), [fecha]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactoForm>({ resolver: zodResolver(contactoSchema) });

  function goNext() {
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function onConfirmar(data: ContactoForm) {
    // Aquí se envía el payload al backend/n8n:
    // { servicio: servicioSlug, fecha, hora, ...data }
    console.log("Reserva enviada:", { servicio: servicioSlug, fecha, hora, ...data });
    setEnviado(true);
    goNext();
  }

  return (
    <Container className="max-w-2xl">
      <h1 className="font-display text-3xl text-ink-900">Reservar cita</h1>
      <p className="mt-2 text-ink-600">
        Cuatro pasos rápidos y quedas agendado.
      </p>

      <div className="mt-10">
        <Stepper steps={steps} current={step} />
      </div>

      <div className="mt-10 rounded-2xl border border-sky-100 bg-white p-6 sm:p-8">
        {step === 0 && (
          <div>
            <p className="font-display text-xl text-ink-900">
              ¿Qué sesión necesitas?
            </p>
            <div className="mt-6 grid gap-3">
              {servicios.map((s) => (
                <label
                  key={s.slug}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors",
                    servicioSlug === s.slug
                      ? "border-deep-600 bg-sky-100"
                      : "border-sky-100 hover:border-sky-300"
                  )}
                >
                  <span>
                    <span className="block font-medium text-ink-900">
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
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="font-display text-xl text-ink-900">
              Elige fecha y hora
            </p>
            <div className="mt-6 flex flex-col gap-8 sm:flex-row">
              <DayPicker
                mode="single"
                selected={fecha}
                onSelect={(d) => {
                  setFecha(d);
                  setHora("");
                }}
                disabled={{ before: new Date() }}
                className="rdp-fisio"
              />
              <div className="flex-1">
                {!fecha && (
                  <p className="text-sm text-ink-600">
                    Selecciona un día para ver los horarios disponibles.
                  </p>
                )}
                {fecha && horas.length === 0 && (
                  <p className="text-sm text-ink-600">
                    No hay horarios disponibles ese día. Prueba otra fecha.
                  </p>
                )}
                {fecha && horas.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {horas.map((h) => (
                      <button
                        key={h}
                        onClick={() => setHora(h)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          hora === h
                            ? "border-deep-600 bg-deep-600 text-white"
                            : "border-sky-300 text-ink-900 hover:bg-sky-100"
                        )}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
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
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit(onConfirmar)}>
            <p className="font-display text-xl text-ink-900">Tus datos</p>
            <div className="mt-6 grid gap-4">
              <Field label="Nombre completo" error={errors.nombre?.message}>
                <input
                  {...register("nombre")}
                  className="fisio-input"
                  placeholder="Ana Torres"
                />
              </Field>
              <Field label="Correo" error={errors.email?.message}>
                <input
                  {...register("email")}
                  type="email"
                  className="fisio-input"
                  placeholder="ana@correo.com"
                />
              </Field>
              <Field label="Teléfono" error={errors.telefono?.message}>
                <input
                  {...register("telefono")}
                  className="fisio-input"
                  placeholder="300 000 0000"
                />
              </Field>
              <Field label="Notas (opcional)">
                <textarea
                  {...register("notas")}
                  className="fisio-input min-h-24"
                  placeholder="Algo que debamos saber antes de tu sesión"
                />
              </Field>
            </div>

            <div className="mt-6 rounded-xl bg-sky-100 p-4 text-sm text-ink-600">
              <p>
                <strong className="text-ink-900">{servicio?.nombre}</strong>{" "}
                — {fecha?.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })} a las {hora}
              </p>
            </div>

            <div className="mt-8 flex justify-between">
              <Button type="button" variant="ghost" onClick={goBack}>
                Atrás
              </Button>
              <Button type="submit">Confirmar reserva</Button>
            </div>
          </form>
        )}

        {step === 3 && enviado && (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto text-deep-600" size={48} />
            <p className="mt-4 font-display text-2xl text-ink-900">
              ¡Reserva enviada!
            </p>
            <p className="mt-2 text-ink-600">
              Te confirmamos por correo apenas quede registrada tu sesión de{" "}
              {servicio?.nombre.toLowerCase()}.
            </p>
            <Button href="/" className="mt-8">
              Volver al inicio
            </Button>
          </div>
        )}
      </div>
    </Container>
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
