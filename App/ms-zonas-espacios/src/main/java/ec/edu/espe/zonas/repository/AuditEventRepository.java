package ec.edu.espe.zonas.repository;

import ec.edu.espe.zonas.entity.AuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    List<AuditEvent> findAllByOrderByCreatedAtDesc();

    List<AuditEvent> findByEntityTypeOrderByCreatedAtDesc(String entityType);
}
