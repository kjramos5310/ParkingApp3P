import { Injectable } from '@nestjs/common';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { Repository } from 'typeorm';
import { FactoryVehiculos } from './factory/factory-vehiculo';
import { AuditEvent, EventPublisher } from '../common/event.publisher.service';

@Injectable()
export class VehiculosService {

  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepository: Repository<Vehiculo>,
    private eventPublisher: EventPublisher
  ) { }

  private async emitEvent(accion: string, vehiculo: Vehiculo, datosExtra?: any) {
    const event: AuditEvent = {
      servicio: 'ms-vehiculos',
      accion: accion.toLowerCase(),
      entidad: 'vehiculo',
      datos: { ...vehiculo, ...datosExtra },
      fecha_hora: new Date(),
      ip: '127.0.0.1',
      mac: '00:00:00:00:00:00',
      id_vehiculo: vehiculo.id,
    };
    await this.eventPublisher.publishAuditEvent(event);
  }

  async create(createVehiculoDto: CreateVehiculoDto): Promise<Vehiculo | null> {
    const existe = await this.vehiculoRepository.findOne(
      {
        where: { placa: createVehiculoDto.datos.placa }
      }
    )
    if (existe) {
      throw new Error('Ya existe un vehiculo con la placa ' + createVehiculoDto.datos.placa)
    }

    const vehiculo = FactoryVehiculos.crear(createVehiculoDto);
    const saved = await this.vehiculoRepository.save(vehiculo);
    await this.emitEvent('CREATE', saved);
    return saved;
  }

  // create(createVehiculoDto: CreateVehiculoDto) {
  //   return 'This action adds a new vehiculo';
  // }

  // promesas

  async findAll(): Promise<Vehiculo[]> {
    return await this.vehiculoRepository.find();
  }

  async findOne(id: string): Promise<Vehiculo | null> {
    const vehiculo = await this.vehiculoRepository.findOne(
      {
        where: { id: id }
      }
    )
    if (!vehiculo) {
      throw new Error('No se encontro ningun vehiculo con el id ' + id)
    }
    return vehiculo;
  }

  async findByPlaca(placa: string): Promise<Vehiculo | null> {
    const vehiculo = await this.vehiculoRepository.findOne({
      where: { placa: placa }
    });
    if (!vehiculo) {
      throw new Error('No se encontro ningun vehiculo con la placa ' + placa);
    }
    return vehiculo;
  }

  update(id: string, updateVehiculoDto: UpdateVehiculoDto) {
    return `This action updates a #${id} vehiculo`;
  }

  remove(id: string) {
    return `This action removes a #${id} vehiculo`;
  }



  // completar y leccion el lunes 
}
