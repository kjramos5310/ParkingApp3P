package ec.edu.espe.usuarios.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users", uniqueConstraints =
        @UniqueConstraint(name = "uk_users_tenant_username", columnNames = {"tenant_id", "username"}))
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @Column(name = "id_person")
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 50, updatable = false,
            columnDefinition = "varchar(50) default 'empresa-a'")
    private String tenantId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "id_person")
    private Person person;

    @Column(nullable = false, length = 25)
    private String username;

    @Column(name = "password", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHashColumn;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @Builder.Default
    private Boolean active = true;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<UserRole> userRoles = new HashSet<>();


    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

}
