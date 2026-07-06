package ec.edu.espe.zonas.services.interfaz;

import ec.edu.espe.zonas.dto.response.AuditEventResponseDto;

import java.util.List;
import java.util.UUID;

public interface AuditService {

    void recordEvent(String action, String entityType, UUID entityId, String description);

    List<AuditEventResponseDto> listEvents();

    List<AuditEventResponseDto> listEventsByEntityType(String entityType);
}
