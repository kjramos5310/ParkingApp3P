package ec.edu.espe.usuarios.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import ec.edu.espe.usuarios.tenant.TenantContext;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                if (!TenantContext.get().equals(tokenProvider.getTenantFromJWT(jwt))) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "El token pertenece a otra empresa");
                    return;
                }
                String username = tokenProvider.getUsernameFromJWT(jwt);
                java.util.List<String> roles = tokenProvider.getRolesFromJWT(jwt);

                java.util.List<org.springframework.security.core.authority.SimpleGrantedAuthority> authorities = java.util.Collections.emptyList();
                if (roles != null) {
                    authorities = roles.stream()
                            .map(org.springframework.security.core.authority.SimpleGrantedAuthority::new)
                            .collect(java.util.stream.Collectors.toList());
                }

                UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
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
            // Error de autenticación silencioso o loggear si se prefiere
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        if (request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if (("PARKING_TOKEN_" + TenantContext.get()).equals(cookie.getName())) return cookie.getValue();
            }
        }
        return null;
    }
}
