import { CreateVehiculoDto } from '../dto/create-vehiculo.dto';
import { Auto } from '../entities/auto.entity';
import { Camioneta } from '../entities/camioneta.entity';
import { Motocicleta } from '../entities/motocicleta.entity';
import { Vehiculo } from '../entities/vehiculo.entity';

export class FactoryVehiculos {
    static crear(dto: CreateVehiculoDto): Vehiculo {
        switch (dto.tipo) {
            case 'Auto':
                const auto = new Auto();
                Object.assign(auto, dto.datos);
                return auto;
            case 'Motocicleta':
                const moto = new Motocicleta();
                const datosMoto = dto.datos as any;
                Object.assign(moto, datosMoto);
                moto.tipoMotocicleta = datosMoto.tipo;
                delete (moto as any).tipo;
                return moto;
            case 'Camioneta':
                const camioneta = new Camioneta();
                Object.assign(camioneta, dto.datos);
                return camioneta;
            default:
                throw new Error(`Tipo de vehículo no soportado: ${dto.tipo}`);
        }
    }
}