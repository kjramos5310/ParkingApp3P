package ec.edu.espe.zonas.entity;

import ec.edu.espe.zonas.entity.TipoZona;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name="zonas", uniqueConstraints = {
        @UniqueConstraint(name="uk_zona_tenant_nombre", columnNames={"tenant_id", "nombre"}),
        @UniqueConstraint(name="uk_zona_tenant_codigo", columnNames={"tenant_id", "codigo"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Zona{
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name="tenant_id", length=50, updatable=false)
    private String tenantId;

    @Column(nullable = false)
    private String nombre;

    @Column(nullable = false, length = 30)
    private String codigo;
    
    @Column(nullable = true)
    private String descripcion;

    @Column(nullable = true)
    private int capacidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoZona tipo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column
    private boolean active;

    @OneToMany(mappedBy = "zona", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private java.util.List<Espacio> espacios = new java.util.ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        active = true;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
