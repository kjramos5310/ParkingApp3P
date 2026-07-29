import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Bandeja de salida (outbox) de los eventos de auditoria.
 *
 * El evento se escribe PRIMERO en esta tabla, dentro de la misma base de datos
 * del microservicio, y solo despues se intenta publicar en RabbitMQ. Un relay
 * periodico reintenta las filas que siguen sin publicar.
 *
 * Es lo que permite que no se pierda ningun evento cuando el broker esta caido:
 * un buffer en memoria desaparece si el pod se reinicia, mientras que estas
 * filas sobreviven al reinicio y se publican en cuanto RabbitMQ vuelve.
 *
 * Las filas ya publicadas se conservan como traza y el relay las purga cuando
 * superan la ventana de retencion.
 */
@Entity({ name: 'audit_outbox' })
// Indice del camino caliente del relay: pendientes en orden de creacion.
@Index('idx_outbox_pendiente', ['publicadoEn', 'creadoEn'])
export class AuditOutbox {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'tenant_id', length: 50 })
    tenantId!: string;

    /** Evento serializado tal cual se enviara al exchange. */
    @Column({ type: 'jsonb' })
    payload!: Record<string, any>;

    @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
    creadoEn!: Date;

    /** NULL mientras el broker no haya confirmado la publicacion. */
    @Column({ name: 'publicado_en', type: 'timestamptz', nullable: true })
    publicadoEn?: Date | null;

    @Column({ type: 'int', default: 0 })
    intentos!: number;

    @Column({ name: 'ultimo_error', type: 'text', nullable: true })
    ultimoError?: string | null;
}
