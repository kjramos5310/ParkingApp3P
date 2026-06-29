import { ChildEntity, Column } from "typeorm";
import { Vehiculo } from "./vehiculo.entity";

export enum TipoMotocicleta {
    SCOOTER = 'SCOOTER',
    DEPORTIVA = 'DEPORTIVA',
    TURISMO = 'TURISMO',
    CHOw = 'CHOw',
    CUATRIMOTO = 'CUATRIMOTO',
    ENDURO = 'ENDURO'
}

@ChildEntity('Motocicleta')
export class Motocicleta extends Vehiculo {

    @Column()
    cilindraje!: number;

    @Column()
    tipoManubrio!: string;

    @Column()
    tipo!: TipoMotocicleta;

    obtenerTipo(): string {
        return 'Moto';
    }
}