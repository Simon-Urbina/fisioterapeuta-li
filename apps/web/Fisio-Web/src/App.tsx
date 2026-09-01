import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import ServiciosPage from "@/pages/Servicios";
import NosotrosPage from "@/pages/Nosotros";
import ReservarPage from "@/pages/Reservar";
import AdminLoginPage from "@/pages/admin/Login";
import AdminAgendaPage from "@/pages/admin/Agenda";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/servicios" element={<ServiciosPage />} />
      <Route path="/nosotros" element={<NosotrosPage />} />
      <Route path="/reservar" element={<ReservarPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/agenda" element={<AdminAgendaPage />} />
    </Routes>
  );
}
