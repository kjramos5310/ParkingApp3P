package ec.edu.espe.usuarios.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "person", uniqueConstraints = {
        @UniqueConstraint(name = "uk_person_tenant_dni", columnNames = {"tenant_id", "dni"}),
        @UniqueConstraint(name = "uk_person_tenant_email", columnNames = {"tenant_id", "email"}),
        @UniqueConstraint(name = "uk_person_tenant_phone", columnNames = {"tenant_id", "phone"})
})
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Person {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 50, updatable = false,
            columnDefinition = "varchar(50) default 'empresa-a'")
    private String tenantId;

    @Column(nullable = false, length = 25)
    private String dni;

    @Column(nullable = false, length = 25)
    private String firstName;

    @Column(nullable = false, length = 25)
    private String middleName;

    @Column(nullable = false, length = 25)
    private String lastName;

    @Column(nullable = false, length = 50)
    private String email;

    @Column(nullable = false, length = 15)
    private String phone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "nacionality", length = 25)
    private String nationality;

    @Builder.Default
    private Boolean active = true;

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
