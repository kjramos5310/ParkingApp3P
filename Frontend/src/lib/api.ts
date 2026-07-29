import type {
  CrearEmpresaDto,
  EmpresaTenant,
  EventoAuditoria,
  Espacio,
  EstadoEspacio,
  Rol,
  Sesion,
  Ticket,
  Usuario,
  Vehiculo,
  Zona,
} from './types';

/**
 * Cliente HTTP unico de la SPA.
 *
 * Todas las llamadas salen contra /api del mismo origen: en produccion el
 * Ingress las enruta a Kong, y en desarrollo lo hace el proxy de Vite. Kong
 * valida el JWT antes de que la peticion alcance cualquier microservicio.
 */

const BASE = '/api';

const CLAVE_TOKEN = 'parqueadero.token';
const CLAVE_SESION = 'parqueadero.sesion';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Se dispara cuando el token deja de ser valido, para que la app cierre sesion. */
export const EVENTO_SESION_EXPIRADA = 'parqueadero:sesion-expirada';

export function leerToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function guardarSesion(sesion: Sesion): void {
  localStorage.setItem(CLAVE_TOKEN, sesion.token);
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
}

export function leerSesion(): Sesion | null {
  const bruto = localStorage.getItem(CLAVE_SESION);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as Sesion;
  } catch {
    return null;
  }
}

export function borrarSesion(): void {
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_SESION);
}

/** Mensaje legible a partir de los distintos formatos de error del backend. */
async function mensajeDeError(res: Response): Promise<string> {
  let cuerpo: unknown;
  try {
    cuerpo = await res.json();
  } catch {
    return res.statusText || `Error ${res.status}`;
  }

  if (typeof cuerpo === 'string') return cuerpo;

  const obj = cuerpo as Record<string, unknown>;
  const message = obj?.message;
  // class-validator devuelve un arreglo de mensajes
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string') return message;
  if (typeof obj?.error === 'string') return obj.error as string;

  return `Error ${res.status}`;
}

interface OpcionesPeticion {
  method?: string;
  body?: unknown;
  tenant?: string;
}

async function peticion<T>(ruta: string, opciones?: OpcionesPeticion): Promise<T> {
  const { method = 'GET', body, tenant } = opciones ?? {};
  const token = leerToken();

  const headers: Record<string, string> = {};
  if (tenant) headers['X-Tenant-ID'] = tenant;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    borrarSesion();
    window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
    throw new ApiError(401, 'Tu sesion expiro. Vuelve a iniciar sesion.');
  }

  if (res.status === 429) {
    throw new ApiError(429, 'Demasiadas peticiones. Espera un momento y reintenta.');
  }

  if (!res.ok) {
    throw new ApiError(res.status, await mensajeDeError(res));
  }

  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

/* -------------------------------------------------------------------------- */
/* Autenticacion                                                              */
/* -------------------------------------------------------------------------- */

export const auth = {
  login: (tenant: string, username: string, password: string) =>
    peticion<Sesion>('/auth/login', { method: 'POST', tenant, body: { username, password } }),
};

/* -------------------------------------------------------------------------- */
/* Zonas y espacios                                                           */
/* -------------------------------------------------------------------------- */

export interface ZonaPayload {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  capacidad: number;
  tipo: string;
}

export const zonas = {
  listar: (tenant: string) => peticion<Zona[]>('/zonas', { tenant }),
  crear: (tenant: string, datos: ZonaPayload) =>
    peticion<Zona>('/zonas', { method: 'POST', tenant, body: datos }),
  actualizar: (tenant: string, id: string, datos: ZonaPayload) =>
    peticion<Zona>(`/zonas/${id}`, { method: 'PUT', tenant, body: datos }),
  eliminar: (tenant: string, id: string) =>
    peticion<void>(`/zonas/${id}`, { method: 'DELETE', tenant }),
};

export interface EspacioPayload {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  tipo: string;
  idZona: string;
}

export const espacios = {
  listar: (tenant: string) => peticion<Espacio[]>('/espacios', { tenant }),
  porZona: (tenant: string, idZona: string) =>
    peticion<Espacio[]>(`/espacios/zona/${idZona}`, { tenant }),
  crear: (tenant: string, datos: EspacioPayload) =>
    peticion<Espacio>('/espacios', { method: 'POST', tenant, body: datos }),
  actualizar: (tenant: string, id: string, datos: EspacioPayload) =>
    peticion<Espacio>(`/espacios/${id}`, { method: 'PUT', tenant, body: datos }),
  eliminar: (tenant: string, id: string) =>
    peticion<void>(`/espacios/${id}`, { method: 'DELETE', tenant }),
  cambiarEstado: (tenant: string, id: string, estado: EstadoEspacio) =>
    peticion<Espacio>(`/espacios/${id}/estado/${estado}`, { method: 'PATCH', tenant }),
};

/* -------------------------------------------------------------------------- */
/* Vehiculos                                                                  */
/* -------------------------------------------------------------------------- */

export interface VehiculoPayload {
  tipo: string;
  datos: Record<string, unknown>;
}

export const vehiculos = {
  listar: (tenant: string) => peticion<Vehiculo[]>('/vehiculos', { tenant }),
  crear: (tenant: string, datos: VehiculoPayload) =>
    peticion<Vehiculo>('/vehiculos', { method: 'POST', tenant, body: datos }),
  actualizar: (tenant: string, id: string, datos: VehiculoPayload) =>
    peticion<Vehiculo>(`/vehiculos/${id}`, { method: 'PATCH', tenant, body: datos }),
  eliminar: (tenant: string, id: string) =>
    peticion<void>(`/vehiculos/${id}`, { method: 'DELETE', tenant }),
};

/* -------------------------------------------------------------------------- */
/* Tickets                                                                    */
/* -------------------------------------------------------------------------- */

export interface TicketPayload {
  placa: string;
  dni: string;
  idEspacio: string;
  nombreZona: string;
}

export const tickets = {
  listar: (tenant: string) => peticion<Ticket[]>('/tickets', { tenant }),
  activos: (tenant: string) => peticion<Ticket[]>('/tickets/activos', { tenant }),
  crear: (tenant: string, datos: TicketPayload) =>
    peticion<Ticket>('/tickets', { method: 'POST', tenant, body: datos }),
  /** PATCH cierra el ticket: registra la salida y calcula el valor a cobrar. */
  registrarSalida: (tenant: string, id: string) =>
    peticion<Ticket>(`/tickets/${id}`, { method: 'PATCH', tenant, body: {} }),
};

/* -------------------------------------------------------------------------- */
/* Usuarios y roles                                                           */
/* -------------------------------------------------------------------------- */

export const usuarios = {
  listar: (tenant: string) => peticion<Usuario[]>('/users', { tenant }),
  crear: (tenant: string, datos: Record<string, unknown>) =>
    peticion<Usuario>('/users', { method: 'POST', tenant, body: datos }),
  asignarRol: (tenant: string, idUsuario: string, idRol: string) =>
    peticion<Usuario>(`/users/${idUsuario}/roles/${idRol}`, { method: 'POST', tenant }),
};

export const roles = {
  // RoleController esta mapeado en /api/v1/roles
  listar: (tenant: string) => peticion<Rol[]>('/v1/roles', { tenant }),
  crear: (tenant: string, datos: { name: string; description: string }) =>
    peticion<Rol>('/v1/roles', { method: 'POST', tenant, body: datos }),
  eliminar: (tenant: string, id: string) =>
    peticion<void>(`/v1/roles/${id}`, { method: 'DELETE', tenant }),
};

/* -------------------------------------------------------------------------- */
/* Auditoria                                                                  */
/* -------------------------------------------------------------------------- */

export const auditoria = {
  /** Kong expone el historial de ms-audith bajo /api/auditoria. */
  listar: (tenant: string) => peticion<EventoAuditoria[]>('/auditoria', { tenant }),
};

/* -------------------------------------------------------------------------- */
/* SuperAdmin - Empresas / Tenants                                            */
/* -------------------------------------------------------------------------- */

export const empresas = {
  listar: () => peticion<EmpresaTenant[]>('/tenants'),
  crear: (datos: CrearEmpresaDto) =>
    peticion<EmpresaTenant>('/tenants', { method: 'POST', body: datos }),
  eliminar: (tenantId: string) =>
    peticion<void>(`/tenants/${tenantId}`, { method: 'DELETE' }),
};
