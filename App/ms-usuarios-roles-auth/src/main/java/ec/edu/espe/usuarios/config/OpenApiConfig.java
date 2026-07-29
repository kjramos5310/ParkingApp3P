package ec.edu.espe.usuarios.config;

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
 * Documentacion OpenAPI 3 del microservicio de usuarios, roles y autenticacion.
 * Swagger UI queda disponible en /swagger-ui.html y el contrato en /v3/api-docs.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI usuariosOpenAPI() {
        final String jwtScheme = "JWT";

        return new OpenAPI()
                .info(new Info()
                        .title("MS-Usuarios - Sistema de Parqueaderos SaaS")
                        .description("""
                                Administracion de usuarios, personas, roles y emision de JWT.

                                **Multitenancy:** toda peticion debe incluir la cabecera `X-Tenant-ID`
                                con el identificador de la empresa. El token emitido queda ligado a ese
                                tenant y es rechazado si se usa contra otro.

                                **Autenticacion:** obten el token en `POST /api/auth/login` y enviarlo
                                como `Authorization: Bearer <token>`.
                                """)
                        .version("1.0")
                        .contact(new Contact().name("ESPE - Arquitectura de Software"))
                        .license(new License().name("Uso academico")))
                .servers(List.of(
                        new Server().url("https://parqueadero.espe.edu.ec").description("Produccion (via Kong)"),
                        new Server().url("http://localhost:8080").description("Desarrollo local")))
                .components(new Components()
                        .addSecuritySchemes(jwtScheme, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT emitido por POST /api/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList(jwtScheme));
    }
}
