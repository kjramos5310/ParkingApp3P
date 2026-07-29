import { Injectable } from '@nestjs/common';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
      tenant_id: vehiculo.tenantId,
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

  async create(tenantId: string, createVehiculoDto: CreateVehiculoDto): Promise<Vehiculo | null> {
    const existe = await this.vehiculoRepository.findOne(
      {
        where: { tenantId, placa: createVehiculoDto.datos.placa }
      }
    )
    if (existe) {
      throw new ConflictException('La placa ya está registrada en este tenant')
    }

    const vehiculo = FactoryVehiculos.crear(createVehiculoDto);
    vehiculo.tenantId = tenantId;
    let saved: Vehiculo;
    try {
      saved = await this.vehiculoRepository.save(vehiculo);
    } catch (error: any) {
      if (error?.driverError?.code === '23505') throw new ConflictException('La placa ya está registrada en este tenant');
      throw error;
    }
    await this.emitEvent('CREATE', saved);
    return saved;
  }

  // create(createVehiculoDto: CreateVehiculoDto) {
  //   return 'This action adds a new vehiculo';
  // }

  // promesas

  async findAll(tenantId: string): Promise<Vehiculo[]> {
    return await this.vehiculoRepository.find({ where: { tenantId } });
  }

  async findOne(tenantId: string, id: string): Promise<Vehiculo | null> {
    const vehiculo = await this.vehiculoRepository.findOne(
      {
        where: { tenantId, id: id }
      }
    )
    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado')
    }
    return vehiculo;
  }

  async findByPlaca(tenantId: string, placa: string): Promise<Vehiculo | null> {
    const vehiculo = await this.vehiculoRepository.findOne({
      where: { tenantId, placa: placa }
    });
    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }
    return vehiculo;
  }

  async update(tenantId: string, id: string, updateVehiculoDto: UpdateVehiculoDto): Promise<Vehiculo> {
    const vehiculo = await this.findOne(tenantId, id);
    const datos = updateVehiculoDto.datos as Partial<Vehiculo> | undefined;

    if (datos?.placa && datos.placa !== vehiculo.placa) {
      const duplicado = await this.vehiculoRepository.findOne({ where: { tenantId, placa: datos.placa } });
      if (duplicado) throw new ConflictException('La placa ya está registrada en este tenant');
    }

    Object.assign(vehiculo, datos ?? {});
    try {
      const actualizado = await this.vehiculoRepository.save(vehiculo);
      await this.emitEvent('UPDATE', actualizado);
      return actualizado;
    } catch (error: any) {
      if (error?.driverError?.code === '23505') throw new ConflictException('La placa ya está registrada en este tenant');
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const vehiculo = await this.findOne(tenantId, id);
    await this.vehiculoRepository.remove(vehiculo);
    await this.emitEvent('DELETE', vehiculo);
  }



  // completar y leccion el lunes 
}
