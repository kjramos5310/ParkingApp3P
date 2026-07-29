import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { auth as apiAuth, borrarSesion, EVENTO_SESION_EXPIRADA, guardarSesion, leerSesion } from './api';
import { guardarTenant, resolverTenant } from './tenant';
import type { Sesion } from './types';

interface EstadoAuth {
  sesion: Sesion | null;
  tenant: string | null;
  esAdmin: boolean;
  iniciarSesion: (tenant: string, usuario: string, clave: string) => Promise<void>;
  cerrarSesion: () => void;
}

const ContextoAuth = createContext<EstadoAuth | null>(null);

/** El backend emite ROLE_ADMIN; aceptamos ambas formas por robustez. */
function tieneRolAdmin(roles: string[] | undefined): boolean {
  return (roles ?? []).some((rol) => {
    const normalizado = rol.toUpperCase();
    return normalizado === 'ROLE_ADMIN' || normalizado === 'ADMIN';
  });
}

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion());
  const [tenant, setTenant] = useState<string | null>(() => resolverTenant());

  const cerrarSesion = useCallback(() => {
    borrarSesion();
    setSesion(null);
  }, []);

  // El cliente API avisa cuando el backend rechaza el token (401).
  useEffect(() => {
    const alExpirar = () => setSesion(null);
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, []);

  const iniciarSesion = useCallback(async (empresa: string, usuario: string, clave: string) => {
    const nueva = await apiAuth.login(empresa, usuario, clave);
    guardarSesion(nueva);
    guardarTenant(empresa);
    setTenant(empresa);
    setSesion(nueva);
  }, []);

  const valor = useMemo<EstadoAuth>(
    () => ({
      sesion,
      tenant,
      esAdmin: tieneRolAdmin(sesion?.roles),
      iniciarSesion,
      cerrarSesion,
    }),
    [sesion, tenant, iniciarSesion, cerrarSesion],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth(): EstadoAuth {
  const contexto = useContext(ContextoAuth);
  if (!contexto) throw new Error('useAuth debe usarse dentro de ProveedorAuth');
  return contexto;
}

/**
 * Tenant garantizado para las paginas internas: solo se renderizan cuando ya
 * existe sesion, y una sesion siempre lleva un tenant asociado.
 */
export function useTenant(): string {
  const { tenant } = useAuth();
  if (!tenant) throw new Error('No hay tenant activo');
  return tenant;
}
