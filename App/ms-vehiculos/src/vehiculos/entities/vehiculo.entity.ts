import { Column, Entity, Index, PrimaryGeneratedColumn, TableInheritance } from 'typeorm';

export enum Clasificacion {
    ELECTRICO = 'ELECTRICO',
    GASOLINA = 'GASOLINA',
    DIESEL = 'DIESEL',
    HIBRIDO = 'HIBRIDO',
    HIBRIDO_ENCHUFABLE = 'HIBRIDO_ENCHUFABLE',
}


@Entity()
@Index('uk_vehiculo_tenant_placa', ['tenantId', 'placa'], { unique: true })
@TableInheritance({ column: { name: 'tipo', type: 'varchar' } })
export abstract class Vehiculo {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'tenant_id', length: 50, default: 'empresa-a' })
    tenantId!: string;

    @Column()
    placa!: string;

    @Column()
    marca!: string;

    @Column()
    modelo!: string;

    @Column()
    color!: string;

    @Column({ nullable: true })
    clasificacion?: string;

    abstract obtenerTipo(): string;

}
