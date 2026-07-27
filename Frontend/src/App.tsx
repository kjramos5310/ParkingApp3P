import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { useAuth } from './lib/auth';
import { Auditoria } from './pages/Auditoria';
import { Espacios } from './pages/Espacios';
import { Login } from './pages/Login';
import { Ocupacion } from './pages/Ocupacion';
import { Tickets } from './pages/Tickets';
import { Usuarios } from './pages/Usuarios';
import { Vehiculos } from './pages/Vehiculos';
import { Zonas } from './pages/Zonas';

export function App() {
  const { sesion, esAdmin } = useAuth();

  if (!sesion) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Shell />}>
        <Route index element={<Ocupacion />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="zonas" element={<Zonas />} />
        <Route path="espacios" element={<Espacios />} />
        <Route path="vehiculos" element={<Vehiculos />} />
        <Route path="usuarios" element={<Usuarios />} />
        {/* El panel de auditoria es exclusivo de roles administrativos */}
        <Route path="auditoria" element={esAdmin ? <Auditoria /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
