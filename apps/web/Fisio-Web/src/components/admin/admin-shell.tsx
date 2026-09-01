import { Link } from "react-router-dom";
import {
  CalendarDays,
  Users,
  Stethoscope,
  Plug,
  History,
  LogOut,
} from "lucide-react";

const nav = [
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "#", label: "Clientes", icon: Users },
  { href: "#", label: "Servicios", icon: Stethoscope },
  { href: "#", label: "Integraciones", icon: Plug },
  { href: "#", label: "Historial", icon: History },
];

export function AdminShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-mist">
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-sky-100 bg-white p-6 sm:flex">
        <div>
          <Link to="/" className="font-display text-lg text-ink-900">
            Fisioterapeuta <span className="text-deep-600">Li</span>
          </Link>

          <nav className="mt-10 flex flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = item.label === active;
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-sky-100 font-medium text-deep-600"
                      : "text-ink-600 hover:bg-sky-100"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <Link
          to="/admin/login"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-sky-100"
        >
          <LogOut size={18} />
          Cerrar sesión
        </Link>
      </aside>

      <main className="flex-1 p-6 sm:p-10">{children}</main>
    </div>
  );
}
