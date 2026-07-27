import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

@Entity()
@Index('idx_ticket_tenant_activo', ['tenantId', 'activo'])
@Index('idx_ticket_tenant_placa', ['tenantId', 'placa'])
export class Ticket {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'tenant_id', length: 50, default: 'empresa-a' })
    tenantId!: string;
    @Column()
    placa!: string;

    @Column()
    dni!: string;

    // zona solo como referencia
    @Column({ type: 'uuid' })
    idEspacio!: string;

    @Column()
    nombreZona!: string;

    @Column()
    fechaHoraIngreso!: Date;
    @Column({ nullable: true })
    fechaHoraSalida?: Date;

    @Column({ type: 'float', nullable: true })
    valorRecaudado?: number;

    @Column()
    activo!: boolean;

    //logs
    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
