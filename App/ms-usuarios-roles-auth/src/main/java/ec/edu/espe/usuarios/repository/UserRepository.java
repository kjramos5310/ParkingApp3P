package ec.edu.espe.usuarios.repository;

import ec.edu.espe.usuarios.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByTenantIdAndUsername(String tenantId, String username);
    Optional<User> findByTenantIdAndId(String tenantId, UUID id);
    List<User> findAllByTenantId(String tenantId);

    @Query("SELECT u FROM User u WHERE u.tenantId = :tenantId AND u.username LIKE CONCAT(:username, '%')")
    List<User> findByPartialUsername(@Param("tenantId") String tenantId, @Param("username") String username);

    @Query("SELECT DISTINCT u.tenantId FROM User u WHERE u.tenantId IS NOT NULL")
    List<String> findDistinctTenants();

    long countByTenantId(String tenantId);

    void deleteAllByTenantId(String tenantId);
}
