package ec.edu.espe.zonas.controller;

import ec.edu.espe.zonas.dto.response.AuditEventResponseDto;
import ec.edu.espe.zonas.services.interfaz.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/audit-events")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<List<AuditEventResponseDto>> listEvents(
            @RequestParam(required = false) String entityType) {
        if (entityType != null && !entityType.isBlank()) {
            return ResponseEntity.ok(auditService.listEventsByEntityType(entityType));
        }
        return ResponseEntity.ok(auditService.listEvents());
    }
}
