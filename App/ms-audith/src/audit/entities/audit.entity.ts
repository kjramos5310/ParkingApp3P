import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'evento_auditoria' })
export class Eventoauditoria {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 50, nullable: false })
    accion!: string; //crear, actualizar, eliminar, consultar

    @Column({ type: 'varchar', length: 50, nullable: false })
    servicio!: string; //servicio de auditoria, users, products

    @Column({ type: 'varchar', length: 100, nullable: false })
    entidad!: string; //user, product, tabla afectada

    @Column({ type: 'timestamp', nullable: false })
    timestamp: Date;

    @Column({ type: 'json', nullable: true })
    datos?: any;

    @Column({ type: 'int', nullable: true })
    id_usuario?: number;

    @Column({ type: 'varchar', length: 100, nullable: true })
    usuario?: string; //john doe xd

    @Column({ type: 'varchar', length: 50, nullable: false })
    ip!: string; //ip publica

    @Column({ type: 'varchar', length: 50, nullable: false })
    mac!: string; //mac address

    @Column({ type: 'varchar', length: 100, nullable: true })
    id_vehiculo?: string;

}
