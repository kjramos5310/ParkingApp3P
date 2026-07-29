/**
 * Defensa en profundidad frente a la invasion de tenant: un usuario del tenant
 * A que intenta leer datos del tenant B reenviando el identificador ajeno en
 * una cabecera propia (X-Tenant: empresa-b) o en la URL (?tenant=empresa-b).
 *
 * Kong ya rechaza esas peticiones en el borde comparandolas contra el claim
 * firmado del JWT, pero el microservicio no debe depender de ello: si alguien
 * alcanza el Service de Kubernetes directamente, sin pasar por el gateway, la
 * misma comprobacion tiene que aplicarse aqui.
 */

/** Express normaliza los nombres de cabecera a minusculas. */
const CABECERAS = [
  'x-tenant-id',
  'x-tenant',
  'x-tenantid',
  'x-tenant-name',
  'tenant',
  'tenant-id',
  'tenantid',
  'x-empresa',
  'empresa',
  'x-empresa-id',
];

/** Parametros de URL equivalentes (aqui si importan las mayusculas). */
const PARAMETROS = [
  'tenant_id',
  'tenant',
  'tenantId',
  'tenantid',
  'tenant-id',
  'empresa',
  'empresa_id',
  'empresaId',
  'idEmpresa',
];

/** Un alias repetido llega como arreglo; solo interesa el primer valor. */
function primerValor(valor: unknown): string | undefined {
  if (Array.isArray(valor)) {
    return typeof valor[0] === 'string' ? valor[0] : undefined;
  }
  return typeof valor === 'string' ? valor : undefined;
}

function discrepa(valor: string | undefined, tenantEfectivo: string): boolean {
  return (
    valor !== undefined &&
    valor.trim() !== '' &&
    valor.trim().toLowerCase() !== tenantEfectivo
  );
}

/**
 * @param tenantEfectivo tenant ya normalizado y autorizado para la peticion
 * @returns descripcion del primer alias que contradice a `tenantEfectivo`, o
 *          `null` si todos coinciden (o no se envio ninguno)
 */
export function discrepanciaDeTenant(
  request: any,
  tenantEfectivo: string,
): string | null {
  for (const nombre of CABECERAS) {
    const valor = primerValor(request?.headers?.[nombre]);
    if (discrepa(valor, tenantEfectivo)) {
      return `cabecera ${nombre}=${valor}`;
    }
  }
  for (const nombre of PARAMETROS) {
    const valor = primerValor(request?.query?.[nombre]);
    if (discrepa(valor, tenantEfectivo)) {
      return `parametro ${nombre}=${valor}`;
    }
  }
  return null;
}
