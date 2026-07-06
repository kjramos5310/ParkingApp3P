package ec.edu.espe.zonas.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEventResponseDto {

    private UUID id;
    private String username;
    private String ipAddress;
    private String macAddress;
    private String httpMethod;
    private String action;
    private String entityType;
    private String entityId;
    private String description;
    private String requestPath;
    private LocalDateTime createdAt;
}
