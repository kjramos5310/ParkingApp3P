package ec.edu.espe.zonas.repository;

import ec.edu.espe.zonas.entity.Zona;
import ec.edu.espe.zonas.entity.TipoZona;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface ZonaRepositorio extends JpaRepository<Zona, UUID> {

    Optional<Zona> findByTenantIdAndNombre(String tenantId, String nombre);
    Optional<Zona> findByTenantIdAndCodigo(String tenantId, String codigo);
    Optional<Zona> findByTenantIdAndId(String tenantId, UUID id);
    List<Zona> findAllByTenantId(String tenantId);
    List<Zona> findByTenantIdAndActiveTrue(String tenantId);
    List<Zona> findByTenantIdAndTipo(String tenantId, TipoZona tipo);
    boolean existsByTenantIdAndId(String tenantId, UUID id);
    boolean existsByTenantIdAndNombre(String tenantId, String nombre);
    boolean existsByTenantIdAndCodigo(String tenantId, String codigo);
    long countByTenantIdAndTipo(String tenantId, TipoZona tipo);
}
