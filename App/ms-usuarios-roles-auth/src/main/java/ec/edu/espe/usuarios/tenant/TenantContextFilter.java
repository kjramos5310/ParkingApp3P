package ec.edu.espe.usuarios.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
public class TenantContextFilter extends OncePerRequestFilter {
    /**
     * Endpoints de infraestructura que NO pertenecen a ningun tenant:
     * las probes de Kubernetes y la documentacion OpenAPI se consultan sin
     * cabecera X-Tenant-ID, por lo que exigirla aqui devolveria 400 y dejaria
     * los pods permanentemente fuera de servicio.
     */
    private static final String[] RUTAS_SIN_TENANT = {
            "/actuator", "/v3/api-docs", "/swagger-ui", "/api/tenants"
    };

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        for (String prefijo : RUTAS_SIN_TENANT) {
            if (path.startsWith(prefijo)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        try {
            TenantContext.set(request.getHeader(TenantContext.HEADER));
            chain.doFilter(request, response);
        } catch (IllegalArgumentException ex) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, ex.getMessage());
        } finally {
            TenantContext.clear();
        }
    }
}
