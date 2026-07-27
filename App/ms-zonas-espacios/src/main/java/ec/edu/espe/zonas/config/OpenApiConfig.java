package ec.edu.espe.zonas.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Documentacion OpenAPI 3 del microservicio de zonas y espacios.
 * Swagger UI queda disponible en /swagger-ui.html y el contrato en /v3/api-docs.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI zonasOpenAPI() {
        final String jwtScheme = "JWT";

        return new OpenAPI()
                .info(new Info()
                        .title("MS-Zonas y Espacios - Sistema de Parqueaderos SaaS")
                        .description("""
                                Administracion de la distribucion fisica del parqueadero: zonas,
                                espacios, estados de ocupacion y capacidad.

                                **Tiempo real:** `GET /api/espacios/sse` expone un stream
                                Server-Sent Events con el evento `espacio_cambiado` cada vez que un
                                espacio cambia de estado. El stream esta filtrado por tenant.
                                Como EventSource no permite cabeceras propias, este endpoint acepta
                                el tenant y el token por query string:
                                `/api/espacios/sse?tenant_id=empresa-a&jwt=<token>`.

                                **Multitenancy:** el resto de endpoints exige la cabecera `X-Tenant-ID`.
                                """)
                        .version("1.0")
                        .contact(new Contact().name("ESPE - Arquitectura de Software"))
                        .license(new License().name("Uso academico")))
                .servers(List.of(
                        new Server().url("https://parqueadero.espe.edu.ec").description("Produccion (via Kong)"),
                        new Server().url("http://localhost:8082").description("Desarrollo local")))
                .components(new Components()
                        .addSecuritySchemes(jwtScheme, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT emitido por ms-usuarios en POST /api/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList(jwtScheme));
    }
}
