package ec.edu.espe.zonas.tenant;

import jakarta.servlet.http.HttpServletRequest;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Defensa en profundidad frente a la invasion de tenant: un usuario del tenant
 * A que intenta leer datos del tenant B reenviando el identificador ajeno en
 * una cabecera propia (X-Tenant: empresa-b) o en la URL (?tenant=empresa-b).
 *
 * Kong ya rechaza esas peticiones en el borde comparandolas contra el claim
 * firmado, pero el microservicio no debe depender de ello: si alguien alcanza
 * el Service de Kubernetes directamente, sin pasar por el gateway, la misma
 * comprobacion tiene que aplicarse aqui.
 *
 * El tenant efectivo es el que ya validaron TenantContextFilter (cabecera
 * canonica) y JwtAuthenticationFilter (claim del token). Esta clase solo
 * comprueba que ningun alias adicional contradiga ese valor.
 */
public final class TenantAliases {

    /** Nombres de cabecera con los que se suele intentar suplantar el tenant. */
    private static final List<String> CABECERAS = List.of(
            "X-Tenant-ID", "X-Tenant", "X-TenantId", "X-Tenant-Name",
            "Tenant", "Tenant-Id", "TenantId",
            "X-Empresa", "Empresa", "X-Empresa-Id");

    /** Parametros de URL equivalentes (aqui si importan las mayusculas). */
    private static final List<String> PARAMETROS = List.of(
            "tenant_id", "tenant", "tenantId", "tenantid", "tenant-id",
            "empresa", "empresa_id", "empresaId", "idEmpresa");

    private TenantAliases() {
    }

    /**
     * @param tenantEfectivo tenant ya normalizado y autorizado para la peticion
     * @return descripcion del primer alias que contradice a {@code tenantEfectivo},
     *         o {@code null} si todos coinciden (o no se envio ninguno)
     */
    public static String discrepancia(HttpServletRequest request, String tenantEfectivo) {
        for (String cabecera : CABECERAS) {
            String valor = request.getHeader(cabecera);
            if (discrepa(valor, tenantEfectivo)) {
                return "cabecera " + cabecera + "=" + valor;
            }
        }
        String query = request.getQueryString();
        for (String parametro : PARAMETROS) {
            String valor = parametroDeUrl(query, parametro);
            if (discrepa(valor, tenantEfectivo)) {
                return "parametro " + parametro + "=" + valor;
            }
        }
        return null;
    }

    private static boolean discrepa(String valor, String tenantEfectivo) {
        return valor != null
                && !valor.isBlank()
                && !valor.trim().toLowerCase().equals(tenantEfectivo);
    }

    /**
     * Lee un parametro directamente de la query string.
     *
     * No se usa request.getParameter() a proposito: ante un POST de tipo
     * application/x-www-form-urlencoded ese metodo consume el cuerpo de la
     * peticion y el controlador lo recibiria vacio.
     */
    private static String parametroDeUrl(String query, String nombre) {
        if (query == null || query.isEmpty()) {
            return null;
        }
        for (String par : query.split("&")) {
            int igual = par.indexOf('=');
            String clave = igual >= 0 ? par.substring(0, igual) : par;
            if (clave.equals(nombre)) {
                String valor = igual >= 0 ? par.substring(igual + 1) : "";
                return URLDecoder.decode(valor, StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
