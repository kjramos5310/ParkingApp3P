package ec.edu.espe.zonas.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;
import ec.edu.espe.zonas.tenant.TenantContext;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenValidator tokenValidator;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenValidator.validateToken(jwt)) {
                if (!TenantContext.get().equals(tokenValidator.getTenantFromJWT(jwt))) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "El token pertenece a otra empresa");
                    return;
                }
                String username = tokenValidator.getUsernameFromJWT(jwt);
                List<String> roles = tokenValidator.getRolesFromJWT(jwt);

                List<SimpleGrantedAuthority> authorities = java.util.Collections.emptyList();
                if (roles != null) {
                    authorities = roles.stream()
                            .map(SimpleGrantedAuthority::new)
                            .collect(Collectors.toList());
                }

                UserDetails userDetails = User.builder()
                        .username(username)
                        .password("")
                        .authorities(authorities)
                        .build();

                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, authorities
                );
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (Exception ex) {
            // Silently fail authentication context configuration
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        // La API EventSource del navegador no permite enviar cabeceras propias,
        // por lo que el stream SSE transporta el token como parametro de la URL
        // (mismo nombre que espera el plugin jwt de Kong: uri_param_names=[jwt]).
        if (request.getRequestURI().endsWith("/sse")) {
            String paramToken = request.getParameter("jwt");
            if (StringUtils.hasText(paramToken)) {
                return paramToken;
            }
        }
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if (("PARKING_TOKEN_" + TenantContext.get()).equals(cookie.getName())) return cookie.getValue();
            }
        }
        return null;
    }
}
