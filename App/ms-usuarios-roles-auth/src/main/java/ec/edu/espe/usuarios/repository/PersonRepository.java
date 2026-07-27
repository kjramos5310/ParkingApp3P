package ec.edu.espe.usuarios.repository;

import ec.edu.espe.usuarios.entity.Person;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PersonRepository extends JpaRepository<Person, UUID> {
    boolean existsByTenantIdAndDni(String tenantId, String dni);
    boolean existsByTenantIdAndEmail(String tenantId, String email);
    Optional<Person> findByTenantIdAndDni(String tenantId, String dni);
    Optional<Person> findByTenantIdAndId(String tenantId, UUID id);
    java.util.List<Person> findAllByTenantId(String tenantId);
    void deleteAllByTenantId(String tenantId);
}
