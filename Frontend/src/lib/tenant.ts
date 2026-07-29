/**
 * Resolucion del tenant (empresa) al que pertenece la sesion.
 *
 * Orden de precedencia:
 *   1. Subdominio          empresa-a.parqueadero.espe.edu.ec
 *   2. Parametro de la URL ?tenant=empresa-a
 *   3. Ultima seleccion guardada en el navegador
 *
 * El valor resultante viaja en la cabecera X-Tenant-ID de cada peticion; los
 * microservicios filtran por el y rechazan un token emitido para otra empresa.
 */

const CLAVE_ALMACEN = 'parqueadero.tenant';

/** Mismo formato que validan TenantContext (Java) y JwtAuthGuard (NestJS). */
const FORMATO_TENANT = /^[a-z0-9][a-z0-9-]{1,49}$/;

/** Subdominios que no identifican a un tenant. */
const RESERVADOS = new Set(['www', 'parqueadero', 'localhost', 'app']);

export function esTenantValido(valor: string | null | undefined): valor is string {
  return !!valor && FORMATO_TENANT.test(valor);
}

function desdeSubdominio(): string | null {
  const partes = window.location.hostname.split('.');
  if (partes.length < 3) return null; // sin subdominio propio
  const candidato = partes[0].toLowerCase();
  if (RESERVADOS.has(candidato)) return null;
  return esTenantValido(candidato) ? candidato : null;
}

function desdeQueryString(): string | null {
  const valor = new URLSearchParams(window.location.search).get('tenant')?.toLowerCase();
  return esTenantValido(valor) ? valor : null;
}

export function tenantGuardado(): string | null {
  const valor = localStorage.getItem(CLAVE_ALMACEN);
  return esTenantValido(valor) ? valor : null;
}

/** Tenant activo, o null si aun no se ha elegido uno. */
export function resolverTenant(): string | null {
  return desdeSubdominio() ?? desdeQueryString() ?? tenantGuardado();
}

export function guardarTenant(tenant: string): void {
  localStorage.setItem(CLAVE_ALMACEN, tenant.trim().toLowerCase());
}

/** El tenant viene fijado por el subdominio y el usuario no puede cambiarlo. */
export function tenantFijadoPorDominio(): boolean {
  return desdeSubdominio() !== null;
}
