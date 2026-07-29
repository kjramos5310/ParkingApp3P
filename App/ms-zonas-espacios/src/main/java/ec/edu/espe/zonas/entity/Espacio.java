package ec.edu.espe.zonas.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name="espacios", uniqueConstraints = {
        @UniqueConstraint(name="uk_espacio_tenant_nombre", columnNames={"tenant_id", "nombre"}),
        @UniqueConstraint(name="uk_espacio_tenant_codigo", columnNames={"tenant_id", "codigo"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Espacio {

    @Id
    @GeneratedValue(strategy= GenerationType.UUID)
    private UUID id;

    @Column(name="tenant_id", length=50, updatable=false)
    private String tenantId;

    @Column(nullable=false)
    private String nombre;

    @Column(nullable=false, length = 30)
    private String codigo; //ZON-VIP-01 ZON-REG-01

    @Column(nullable=true)
    private String descripcion;

    @Column(nullable=true)
    private int capacidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoEspacio tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoEspacio estado;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column
    private boolean active;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_zona", nullable = false)
    private Zona zona;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        active = true;
        if (estado == null) {
            estado = EstadoEspacio.DISPONIBLE;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
