import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface Enlace {
  a: string;
  texto: string;
  soloAdmin?: boolean;
}

const ENLACES: Enlace[] = [
  { a: '/', texto: 'Ocupacion' },
  { a: '/tickets', texto: 'Tickets' },
  { a: '/zonas', texto: 'Zonas' },
  { a: '/espacios', texto: 'Espacios' },
  { a: '/vehiculos', texto: 'Vehiculos' },
  { a: '/usuarios', texto: 'Usuarios', soloAdmin: true },
  { a: '/auditoria', texto: 'Auditoria', soloAdmin: true },
  { a: '/superadmin', texto: 'Empresas (SuperAdmin)', soloAdmin: true },
];

export function Shell() {
  const { sesion, tenant, esAdmin, cerrarSesion } = useAuth();
  const visibles = ENLACES.filter((enlace) => !enlace.soloAdmin || esAdmin);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Banda superior: identidad del sistema y de la empresa activa */}
      <header className="bg-board text-white sticky top-0 z-30">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            {/* Marca: los chevrones de direccion pintados en la rampa */}
            <span className="text-hivis font-sign text-lg leading-none tracking-tight" aria-hidden="true">
              &raquo;
            </span>
            <span className="font-sign uppercase tracking-[0.2em] text-sm whitespace-nowrap">
              Parqueadero
            </span>
            {tenant && (
              <span className="font-data text-xs px-2 py-0.5 border border-white/25 rounded-[3px] text-white/75 truncate">
                {tenant}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline font-data text-xs text-white/60 truncate max-w-[12rem]">
              {sesion?.username}
            </span>
            <button
              type="button"
              onClick={cerrarSesion}
              className="font-sign uppercase tracking-widest text-[0.7rem] border border-white/30 px-3 py-1.5 rounded-[3px] hover:bg-white/10"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Navegacion: pestanas de senaletica, no botones redondeados */}
        <nav aria-label="Secciones" className="px-4 sm:px-6 border-t border-white/10">
          <ul className="flex gap-1 overflow-x-auto">
            {visibles.map((enlace) => (
              <li key={enlace.a}>
                <NavLink
                  to={enlace.a}
                  end={enlace.a === '/'}
                  className={({ isActive }) =>
                    `block font-sign uppercase tracking-[0.14em] text-xs px-3 py-2.5 border-b-[3px] whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-hivis text-hivis'
                        : 'border-transparent text-white/60 hover:text-white'
                    }`
                  }
                >
                  {enlace.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-7 max-w-[80rem] w-full mx-auto">
        <Outlet />
      </main>

      <footer className="px-4 sm:px-6 py-4 border-t border-line text-xs text-ink-faint">
        ESPE · Arquitectura de Software · Sistema de parqueaderos SaaS multitenant
      </footer>
    </div>
  );
}
