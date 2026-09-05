import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Plug,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/site/brand-mark";
import { Reveal } from "@/components/site/reveal";

gsap.registerPlugin(useGSAP);

export default function AdminLoginPage() {
  const panelRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Timeline de entrada del panel oscuro: logo -> titular -> bullets ->
  // pie, orquestados juntos en vez de aparecer todos de golpe. La foto
  // además sigue el mouse con un parallax sutil (quickTo -- interpola
  // suave sin recrear el tween en cada movimiento).
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".login-badge", { opacity: 0, y: -14, duration: 0.5 })
        .from(".login-title", { opacity: 0, y: 22, duration: 0.7 }, "-=0.25")
        .from(
          ".login-bullet",
          { opacity: 0, x: -14, duration: 0.4, stagger: 0.1 },
          "-=0.3"
        )
        .from(".login-foot", { opacity: 0, duration: 0.5 }, "-=0.1");

      const el = panelRef.current;
      const photo = photoRef.current;
      if (!el || !photo) return;

      const xTo = gsap.quickTo(photo, "x", { duration: 0.7, ease: "power3.out" });
      const yTo = gsap.quickTo(photo, "y", { duration: 0.7, ease: "power3.out" });
      const onMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / rect.width - 0.5;
        const relY = (e.clientY - rect.top) / rect.height - 0.5;
        xTo(relX * -18);
        yTo(relY * -18);
      };
      el.addEventListener("mousemove", onMove);
      return () => el.removeEventListener("mousemove", onMove);
    },
    { scope: panelRef }
  );

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section
        ref={panelRef}
        className="gradient-bg grain relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
      >
        <div
          ref={photoRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 scale-110 bg-[url('/images/login-portrait.jpg')] bg-cover bg-top opacity-35"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-950/10 via-brand-950/40 to-brand-950/85" />

        <div className="animate-float-lg pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div
          className="animate-float pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          style={{ animationDelay: "-2s" }}
        />

        <Link to="/" className="login-badge group/brand relative">
          <BrandMark variant="light" />
        </Link>

        <div className="relative">
          <p className="login-title font-display text-4xl font-bold leading-tight">
            Toda tu agenda, tus clientes y tus servicios en un solo lugar.
          </p>
          <p className="login-title mt-4 max-w-sm text-sm leading-relaxed text-sky-100">
            Panel administrativo — solo para el equipo de Fisioterapeuta Li.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-sky-100">
            <li className="login-bullet flex items-center gap-3">
              <CalendarDays size={18} className="text-brand-200" />
              Agenda unificada desde el sitio y Telegram
            </li>
            <li className="login-bullet flex items-center gap-3">
              <Users size={18} className="text-brand-200" />
              Ficha e historial de cada paciente
            </li>
            <li className="login-bullet flex items-center gap-3">
              <Plug size={18} className="text-brand-200" />
              Integraciones y automatizaciones
            </li>
          </ul>
        </div>

        <p className="login-foot relative text-xs text-sky-100/70">
          HackTech 5.0 · Reto 3
        </p>
      </section>

      <section className="dot-grid relative flex items-center justify-center overflow-hidden bg-white p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-[380px] w-[380px] rounded-full bg-brand-400/10 blur-[130px]" />

        <Container className="relative max-w-sm px-0">
          <Reveal variant="left" className="lg:hidden">
            <Link to="/" className="group/brand mb-8 inline-block">
              <BrandMark size="sm" />
            </Link>
          </Reveal>

          <Reveal>
            <h1 className="font-display text-2xl font-bold text-ink-900">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              Ingresa con tu cuenta administrativa.
            </p>
          </Reveal>

          <Reveal delayMs={120}>
            <form className="mt-8 grid gap-4" autoComplete="on">
              {/* Honeypot anti-bots: invisible para personas, si un bot lo
                  rellena se descarta el envío en el backend. */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-900">
                  Correo
                </span>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600"
                  />
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                    className="fisio-input pl-10"
                    placeholder="admin@fisioterapeutali.com"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-900">
                  Contraseña
                </span>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    className="fisio-input pl-10 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-600 transition-colors hover:text-deep-600"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={showPassword ? "on" : "off"}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.15 }}
                        className="flex"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </motion.span>
                    </AnimatePresence>
                  </button>
                </div>
              </label>

              <Button href="/admin/agenda" className="mt-2 w-full">
                Entrar
              </Button>
            </form>
          </Reveal>

          <Reveal delayMs={200}>
            <Link
              to="/"
              className="mt-8 flex items-center justify-center gap-1.5 text-sm text-ink-600 transition-colors hover:text-deep-600"
            >
              <ArrowLeft size={15} /> Volver al sitio
            </Link>
          </Reveal>
        </Container>
      </section>
    </main>
  );
}
