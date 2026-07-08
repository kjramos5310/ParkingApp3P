package ec.edu.espe.usuarios.audit;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Evento de auditoria que se publica a RabbitMQ y consume ms-audith.
 * Los nombres JSON (snake_case) deben coincidir EXACTAMENTE con el
 * CreateAuditDto de ms-audith, de lo contrario el mensaje es rechazado.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL) // omite campos nulos (id_usuario, id_vehiculo)
public class AuditEvent {

    /** ms-usuarios, ms-vehiculos, etc. Debe cumplir ^ms-[a-zA-Z-]+$ */
    private String servicio;

    /** CREATE, UPDATE, DELETE, ... */
    private String accion;

    /** Tabla/entidad afectada. Solo minusculas y guion bajo, 4-15 chars. Ej: roles, usuarios */
    private String entidad;

    /** Detalle del cambio (id, nombre, payload, etc.) */
    private Map<String, Object> datos;

    @JsonProperty("fecha_hora")
    private String fechaHora;

    @JsonProperty("id_usuario")
    private Integer idUsuario;

    /** Quien realizo la accion (username o correo). */
    private String usuario;

    /** IP del solicitante (IPv4). */
    private String ip;

    /** MAC del solicitante. */
    private String mac;

    @JsonProperty("id_vehiculo")
    private String idVehiculo;
}
