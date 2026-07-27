package ec.edu.espe.zonas.repository;

import ec.edu.espe.zonas.entity.EstadoEspacio;
import ec.edu.espe.zonas.entity.Espacio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface EspacioRepository extends JpaRepository<Espacio, UUID> {

    List<Espacio> findByTenantIdAndZonaId(String tenantId, UUID idZona);

    List<Espacio> findByTenantIdAndZonaIdAndEstado(String tenantId, UUID idZona, EstadoEspacio estado);

    List<Espacio> findByTenantIdAndEstado(String tenantId, EstadoEspacio estado);
    List<Espacio> findAllByTenantId(String tenantId);
    java.util.Optional<Espacio> findByTenantIdAndId(String tenantId, UUID id);

    boolean existsByTenantIdAndNombre(String tenantId, String nombre);

    boolean existsByTenantIdAndCodigo(String tenantId, String codigo);

    @Query("SELECT e FROM Espacio e JOIN FETCH e.zona WHERE e.tenantId = :tenantId AND e.estado = :estado")
    List<Espacio> findByEstadoWithZona(@Param("tenantId") String tenantId, @Param("estado") EstadoEspacio estado);
}

