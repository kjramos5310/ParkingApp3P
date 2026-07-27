package ec.edu.espe.zonas.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * TenantContext es la puerta de entrada del aislamiento multitenant: si acepta
 * un identificador invalido, las consultas se filtrarian por un valor que no
 * corresponde a ninguna empresa.
 */
class TenantContextTest {

    @AfterEach
    void limpiar() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Normaliza a minusculas y recorta los espacios")
    void normalizaElIdentificador() {
        assertEquals("empresa-a", TenantContext.normalize("  Empresa-A  "));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "a", "-empresa", "empresa_a", "empresa a", "EMPRESA!"})
    @DisplayName("Rechaza los identificadores que no cumplen el formato")
    void rechazaIdentificadoresInvalidos(String valor) {
        assertThrows(IllegalArgumentException.class, () -> TenantContext.normalize(valor));
    }

    @Test
    @DisplayName("Devuelve el tenant que se fijo en el hilo actual")
    void conservaElTenantDelHilo() {
        TenantContext.set("empresa-b");

        assertEquals("empresa-b", TenantContext.get());
    }

    @Test
    @DisplayName("Sin tenant en contexto, leerlo es un error de programacion")
    void fallaSiNoHayTenant() {
        TenantContext.clear();

        assertThrows(IllegalStateException.class, TenantContext::get);
    }

    @Test
    @DisplayName("Limpiar evita que un hilo reutilizado herede el tenant anterior")
    void limpiaElContexto() {
        TenantContext.set("empresa-a");
        TenantContext.clear();

        assertThrows(IllegalStateException.class, TenantContext::get);
    }
}
