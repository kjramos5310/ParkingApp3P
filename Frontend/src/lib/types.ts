export type EstadoEspacio = 'DISPONIBLE' | 'OCUPADO' | 'RESERVADO' | 'MANTENIMIENTO';
export type TipoEspacio = 'AUTO' | 'MOTO' | 'BUSETA' | 'BUS' | 'CAMION';
export type TipoZona = 'VIP' | 'VISITANTES' | 'GENERAL' | 'PREFERENCIAL';

export interface Zona {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string;
  capacidad: number;
  espaciosDisponibles: number;
  tipo: TipoZona;
  active: boolean;
}

export interface Espacio {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string;
  tipo: TipoEspacio;
  estado: EstadoEspacio;
  active: boolean;
  nombreZona?: string;
  idZona?: string;
}

export interface Vehiculo {
  id: string;
  tipo: string;
  marca: string;
  placa: string;
  modelo: string;
  color: string;
  anio: number;
  [extra: string]: unknown;
}

export interface Ticket {
  id: string;
  placa: string;
  dni: string;
  idEspacio: string;
  nombreZona: string;
  fechaHoraIngreso: string;
  fechaHoraSalida?: string;
  valorRecaudado?: number;
  activo: boolean;
}

export interface Persona {
  id?: string;
  dni: string;
  firstName: string;
  lastName: string;
  email?: string;
  [extra: string]: unknown;
}

export interface Usuario {
  id: string;
  username: string;
  active: boolean;
  lastLogin?: string;
  createdAt?: string;
  person?: Persona;
  roles: string[];
}

export interface Rol {
  id: string;
  name: string;
  description: string;
}

export interface EventoAuditoria {
  id: number;
  tenant_id: string;
  accion: string;
  servicio: string;
  entidad: string;
  timestamp: string;
  datos?: Record<string, unknown>;
  id_usuario?: number;
  usuario?: string;
  ip: string;
  mac: string;
  id_vehiculo?: string;
}

export interface Sesion {
  token: string;
  username: string;
  roles: string[];
  expiresIn: number;
}

export interface EmpresaTenant {
  tenantId: string;
  nombreEmpresa: string;
  adminUsername: string;
  adminEmail: string;
  userCount: number;
  subdominioUrl: string;
  parametroUrl: string;
}

export interface CrearEmpresaDto {
  tenantId: string;
  nombreEmpresa: string;
  adminDni: string;
  adminFirstName: string;
  adminMiddleName?: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone?: string;
  adminAddress?: string;
  adminNationality?: string;
  adminUsername: string;
  adminPassword: string;
}
