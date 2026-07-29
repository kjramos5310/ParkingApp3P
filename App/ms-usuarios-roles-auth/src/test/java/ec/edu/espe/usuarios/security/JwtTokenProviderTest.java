package ec.edu.espe.usuarios.security;

import ec.edu.espe.usuarios.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * El token es la pieza que sostiene el aislamiento entre empresas: si el
 * tenant o el emisor no viajan dentro, ni los microservicios ni Kong pueden
 * decidir si una peticion es legitima.
 */
class JwtTokenProviderTest {

    private static final String SECRETO =
            "clave-de-pruebas-9a7f34c2d6e9f1a0b3c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3";

    private JwtTokenProvider provider;

    @BeforeEach
    void inicializar() {
        provider = new JwtTokenProvider();
        ReflectionTestUtils.setField(provider, "jwtSecret", SECRETO);
        ReflectionTestUtils.setField(provider, "jwtExpirationInMs", 86_400_000L);
        ReflectionTestUtils.setField(provider, "jwtIssuer", "parqueadero-auth");
        TenantContext.set("empresa-a");
    }

    @AfterEach
    void limpiar() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("El token conserva el usuario que lo solicito")
    void conservaElUsuario() {
        String token = provider.generateToken("jdoe");

        assertEquals("jdoe", provider.getUsernameFromJWT(token));
    }

    @Test
    @DisplayName("El token queda ligado al tenant activo al emitirlo")
    void ligaElTenant() {
        String token = provider.generateToken("jdoe");

        assertEquals("empresa-a", provider.getTenantFromJWT(token));
    }

    @Test
    @DisplayName("Un token de otra empresa no coincide con el tenant actual")
    void distingueEntreTenants() {
        String tokenEmpresaA = provider.generateToken("jdoe");

        TenantContext.set("empresa-b");
        String tokenEmpresaB = provider.generateToken("jdoe");

        assertEquals("empresa-a", provider.getTenantFromJWT(tokenEmpresaA));
        assertEquals("empresa-b", provider.getTenantFromJWT(tokenEmpresaB));
    }

    @Test
    @DisplayName("Un token emitido con este secreto se valida correctamente")
    void validaSuPropioToken() {
        assertTrue(provider.validateToken(provider.generateToken("jdoe")));
    }

    @Test
    @DisplayName("Un token firmado con otro secreto se rechaza")
    void rechazaFirmaAjena() {
        JwtTokenProvider intruso = new JwtTokenProvider();
        ReflectionTestUtils.setField(intruso, "jwtSecret",
                "otro-secreto-completamente-distinto-de-al-menos-32-bytes-largo");
        ReflectionTestUtils.setField(intruso, "jwtExpirationInMs", 86_400_000L);
        ReflectionTestUtils.setField(intruso, "jwtIssuer", "parqueadero-auth");

        assertFalse(provider.validateToken(intruso.generateToken("atacante")));
    }

    @Test
    @DisplayName("Un token manipulado se rechaza")
    void rechazaTokenAlterado() {
        String token = provider.generateToken("jdoe");

        assertFalse(provider.validateToken(token + "x"));
    }
}
