package ec.edu.espe.usuarios.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.MacAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import ec.edu.espe.usuarios.tenant.TenantContext;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret:9a7f34c2d6e9f1a0b3c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms:86400000}") // 24 horas por defecto
    private long jwtExpirationInMs;

    /**
     * Emisor del token. Kong lo usa como clave de busqueda del consumer que
     * guarda el secreto de verificacion (plugin jwt con key_claim_name=iss),
     * por lo que debe coincidir con el "key" declarado en kong-config/kong.yml.
     */
    @Value("${app.jwt.issuer:parqueadero-auth}")
    private String jwtIssuer;

    /**
     * Algoritmo de firma fijado de forma explicita.
     *
     * Sin este parametro, jjwt lo deduce del largo de la clave (HS256, HS384 o
     * HS512), asi que cambiar JWT_SECRET podria cambiar el algoritmo en
     * silencio. Kong verifica la firma con el algoritmo declarado en su
     * consumer, de modo que cualquier desvio hace que rechace todos los tokens
     * con 401. Debe coincidir con el "algorithm" de kong-config/kong.yml.
     */
    private static final MacAlgorithm ALGORITMO_FIRMA = Jwts.SIG.HS256;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(Authentication authentication) {
        UserDetails userPrincipal = (UserDetails) authentication.getPrincipal();
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

        java.util.List<String> roles = userPrincipal.getAuthorities().stream()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .collect(java.util.stream.Collectors.toList());

        return Jwts.builder()
                .subject(userPrincipal.getUsername())
                .issuer(jwtIssuer)
                .claim("tenant_id", TenantContext.get())
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey(), ALGORITMO_FIRMA)
                .compact();
    }

    public String generateToken(String username) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

        return Jwts.builder()
                .subject(username)
                .issuer(jwtIssuer)
                .claim("tenant_id", TenantContext.get())
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey(), ALGORITMO_FIRMA)
                .compact();
    }

    public String getUsernameFromJWT(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.getSubject();
    }

    @SuppressWarnings("unchecked")
    public java.util.List<String> getRolesFromJWT(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.get("roles", java.util.List.class);
    }

    public String getTenantFromJWT(String token) {
        return Jwts.parser().verifyWith(getSigningKey()).build()
                .parseSignedClaims(token).getPayload().get("tenant_id", String.class);
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(authToken);
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            // Podríamos logger el error aquí
        }
        return false;
    }

    public long getExpiryDuration() {
        return jwtExpirationInMs;
    }
}
