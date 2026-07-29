package ec.edu.espe.zonas.config;

import ec.edu.espe.zonas.entity.Espacio;
import ec.edu.espe.zonas.entity.EstadoEspacio;
import ec.edu.espe.zonas.entity.TipoEspacio;
import ec.edu.espe.zonas.entity.TipoZona;
import ec.edu.espe.zonas.entity.Zona;
import ec.edu.espe.zonas.repository.EspacioRepository;
import ec.edu.espe.zonas.repository.ZonaRepositorio;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;

/**
 * Siembra zonas y espacios de ejemplo la primera vez que arranca el servicio
 * (solo si la tabla de zonas esta vacia) para que el dashboard muestre datos.
 */
/*
 * Tarea de arranque: migra el esquema y siembra los datos iniciales contra la
 * base real. Se desactiva con app.bootstrap.enabled=false, que es lo que hacen
 * las pruebas para no ejecutar DDL especifico del motor sobre la BD embebida.
 */
@ConditionalOnProperty(name = "app.bootstrap.enabled", havingValue = "true", matchIfMissing = true)
@Component
@RequiredArgsConstructor
@Order(1)
public class DataSeeder implements CommandLineRunner {

    private final ZonaRepositorio zonaRepositorio;
    private final EspacioRepository espacioRepository;

    @Value("${app.tenants:empresa-a,empresa-b}")
    private String configuredTenants;

    @Override
    public void run(String... args) {
        for (String rawTenant : configuredTenants.split(",")) {
            String tenantId = rawTenant.trim().toLowerCase();
            if (tenantId.isEmpty() || !zonaRepositorio.findAllByTenantId(tenantId).isEmpty()) continue;
            seedTenant(tenantId);
        }
    }

    private void seedTenant(String tenantId) {
        String label = labelFor(tenantId);

        Zona vip = zonaRepositorio.save(Zona.builder()
                .tenantId(tenantId)
                .nombre("Zona VIP " + label)
                .codigo("ZON-VIP")
                .descripcion("Zona preferencial de " + label)
                .capacidad(10)
                .tipo(TipoZona.VIP)
                .build());

        Zona general = zonaRepositorio.save(Zona.builder()
                .tenantId(tenantId)
                .nombre("Zona General " + label)
                .codigo("ZON-GEN")
                .descripcion("Zona general de " + label)
                .capacidad(20)
                .tipo(TipoZona.GENERAL)
                .build());

        Zona discapacitados = zonaRepositorio.save(Zona.builder()
                .tenantId(tenantId)
                .nombre("Zona Discapacitados " + label)
                .codigo("ZON-DIS")
                .descripcion("Zona reservada para personas con discapacidad de " + label)
                .capacidad(5)
                .tipo(TipoZona.PREFERENCIAL)
                .build());

        crearEspacio(vip, "ZON-VIP-01", TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE);
        crearEspacio(vip, "ZON-VIP-02", TipoEspacio.AUTO, EstadoEspacio.OCUPADO);
        crearEspacio(vip, "ZON-VIP-03", TipoEspacio.MOTO, EstadoEspacio.RESERVADO);
        crearEspacio(general, "ZON-GEN-01", TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE);
        crearEspacio(general, "ZON-GEN-02", TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE);
        crearEspacio(general, "ZON-GEN-03", TipoEspacio.MOTO, EstadoEspacio.OCUPADO);
        crearEspacio(general, "ZON-GEN-04", TipoEspacio.CAMION, EstadoEspacio.DISPONIBLE);
        crearEspacio(discapacitados, "ZON-DIS-01", TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE);
        crearEspacio(discapacitados, "ZON-DIS-02", TipoEspacio.AUTO, EstadoEspacio.DISPONIBLE);
    }

    // "empresa-a" -> "Empresa A", para que los datos demo de cada tenant se distingan a simple vista
    private String labelFor(String tenantId) {
        StringBuilder label = new StringBuilder();
        for (String part : tenantId.split("-")) {
            if (part.isEmpty()) continue;
            if (label.length() > 0) label.append(' ');
            label.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return label.toString();
    }

    private void crearEspacio(Zona zona, String codigo, TipoEspacio tipo, EstadoEspacio estado) {
        espacioRepository.save(Espacio.builder()
                .tenantId(zona.getTenantId())
                .nombre(codigo)
                .codigo(codigo)
                .descripcion("Espacio " + codigo)
                .tipo(tipo)
                .estado(estado)
                .zona(zona)
                .build());
    }
}
