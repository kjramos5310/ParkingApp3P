import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Persona } from './interfaces/persona.interfaces';
import { Vehiculo } from './interfaces/vehiculo.interfaces';
import { Espacio } from './interfaces/espacio.interfaces';
import { HttpClientService } from './common/httpl-client.service';
import { ConfigService } from '@nestjs/config';
import { EventsService } from '../events/events.service';
import { RedisCacheService } from './common/redis-cache.service';

@Injectable()
export class TicketsService {

  private readonly logger = new Logger(TicketsService.name);

  private readonly personaUrl: string;
  private readonly espacioUrl: string;
  private readonly vehiculoUrl: string;
  private readonly tarifaPorHora: number;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
    private readonly cache: RedisCacheService,
  ) {
    this.personaUrl = configService.get<string>('MS_PERSONAS') || 'http://localhost:8080/api/personas';
    this.espacioUrl = configService.get<string>('MS_ESPACIOS') || 'http://localhost:8080/api/espacios';
    this.vehiculoUrl = configService.get<string>('MS_VEHICULOS') || 'http://localhost:8080/api/vehiculos';
    this.tarifaPorHora = parseFloat(configService.get<string>('TARIFA_HORA') || '1.0');
  }

  async create(tenantId: string, createTicketDto: CreateTicketDto): Promise<Ticket> {
    // 1 validar persona
    const persona = await this.validarPersona(tenantId, createTicketDto.dni);
    if (!persona) throw new BadRequestException('Persona no encontrada');

    // 2 valido placa
    const vehiculo = await this.validarPlaca(tenantId, createTicketDto.placa);
    if (!vehiculo) throw new BadRequestException('Vehiculo no encontrado');

    // 3 buscar espacio disponible
    const espacio = await this.buscarEspacioDisponible(tenantId, createTicketDto.idEspacio, createTicketDto.nombreZona);
    if (!espacio) throw new ConflictException('Espacio no disponible');

    // REGLA DE NEGOCIO: Compatibilidad de tipo de vehiculo con tipo de espacio
    const tipoVehiculo = (vehiculo as any).tipo?.toLowerCase() || '';
    const tipoEspacio = espacio.tipo?.toLowerCase() || '';

    if (tipoEspacio === 'moto' && tipoVehiculo !== 'motocicleta' && tipoVehiculo !== 'moto') {
      throw new BadRequestException('Un vehiculo que no es motocicleta no puede parquear en un espacio de moto');
    }
    if (tipoEspacio === 'auto' && (tipoVehiculo === 'motocicleta' || tipoVehiculo === 'moto')) {
      throw new BadRequestException('Una motocicleta no puede parquear en un espacio de auto');
    }

    // 4 validar que no tenga tickets activos (por placa y por DNI)
    const tieneTicketActivo = await this.validarTicketActivo(tenantId, createTicketDto.placa);
    if (tieneTicketActivo) {
      throw new ConflictException('El vehículo ya posee un ticket activo');
    }
    const tienePersonaTicketActivo = await this.validarPersonaTicketActivo(tenantId, createTicketDto.dni);
    if (tienePersonaTicketActivo) {
      throw new ConflictException('La persona ya posee un ticket activo');
    }

    // 5 generar ticket
    const ticket = this.ticketRepository.create({
      ...createTicketDto,
      tenantId,
      fechaHoraIngreso: new Date(),
      activo: true,
      valorRecaudado: 0,
    });

    // La ocupacion usa compare-and-set en ms-zonas: solo una solicitud puede
    // ganar cuando dos tickets compiten por el mismo espacio.
    await this.actualizarEstadoEspacio(tenantId, createTicketDto.idEspacio, 'OCUPADO');

    let TicketGuardado: Ticket;
    try {
      TicketGuardado = await this.ticketRepository.save(ticket);
    } catch (error: any) {
      // Compensacion: si la persistencia falla, el espacio no puede quedar
      // ocupado sin un ticket asociado.
      try {
        await this.actualizarEstadoEspacio(tenantId, createTicketDto.idEspacio, 'DISPONIBLE');
      } catch (compensacion) {
        this.logger.error(`Fallo compensando el espacio ${createTicketDto.idEspacio}: ${compensacion}`);
      }
      if (error?.driverError?.code === '23505') {
        throw new ConflictException('El vehículo o el espacio ya posee un ticket activo');
      }
      throw error;
    }

    this.logger.log(`Ticket creado con exito: ${JSON.stringify(TicketGuardado)} para la placa ${createTicketDto.placa}`);

    // Notificar al dashboard (SSE)
    this.eventsService.emit(tenantId, {
      type: 'ticket_creado',
      data: {
        id: TicketGuardado.id,
        placa: TicketGuardado.placa,
        idEspacio: TicketGuardado.idEspacio,
        estado: 'OCUPADO',
      },
    });

    return TicketGuardado;
  }

  async findAll(tenantId: string): Promise<Ticket[]> {
    return this.ticketRepository.find({ where: { tenantId }, order: { fechaHoraIngreso: 'DESC' } });
  }

  async findOne(tenantId: string, id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { tenantId, id } });

    if (!ticket) {
      throw new NotFoundException("Ticket no encontrado");
    }

    return ticket;
  }

  async findActivos(tenantId: string): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { tenantId, activo: true },
      order: { fechaHoraIngreso: 'DESC' }
    });
  }

  async update(tenantId: string, id: string, updateTicketDto?: UpdateTicketDto): Promise<Ticket> {
    return this.cerrarTicket(tenantId, id, updateTicketDto);
  }

  async cerrarTicket(tenantId: string, id: string, updateTicketDto?: UpdateTicketDto): Promise<Ticket> {
    //1 buscar ticket
    const ticket = await this.findOne(tenantId, id);
    if (!ticket.activo) {
      throw new ConflictException('El ticket ya se encuentra cerrado');
    }

    ticket.fechaHoraSalida = new Date();

    //4 calcular valor recaudado
    const horas = this.calcularHoras(ticket.fechaHoraIngreso, ticket.fechaHoraSalida);
    let costo = horas * this.tarifaPorHora;

    // APLICAR DESCUENTO ECOLOGICO (REGLA DE NEGOCIO)
    const vehiculo = await this.validarPlaca(tenantId, ticket.placa);
    if (vehiculo && (
      vehiculo.clasificacion === 'ELECTRICO' ||
      vehiculo.clasificacion === 'HIBRIDO' ||
      vehiculo.clasificacion === 'HIBRIDO_ENCHUFABLE'
    )) {
      costo = costo * 0.5;
      this.logger.log(`Se aplico un descuento del 50% por vehiculo ecologico (${vehiculo.clasificacion}) para placa ${ticket.placa}`);
    }

    ticket.valorRecaudado = updateTicketDto?.valorRecaudado ?? costo;

    // Cierre compare-and-set: ante dos cierres simultaneos solo uno cambia
    // activo=true a false y, por tanto, solo uno libera el espacio.
    const resultado = await this.ticketRepository.update(
      { tenantId, id, activo: true },
      {
        activo: false,
        fechaHoraSalida: ticket.fechaHoraSalida,
        valorRecaudado: ticket.valorRecaudado,
      },
    );
    if (resultado.affected !== 1) {
      throw new ConflictException('El ticket ya se encuentra cerrado');
    }

    await this.actualizarEstadoEspacio(tenantId, ticket.idEspacio, 'DISPONIBLE');
    const closedTicket = await this.ticketRepository.findOne({ where: { tenantId, id } });
    if (!closedTicket) throw new NotFoundException('Ticket no encontrado tras el cierre');
    this.logger.log(`Ticket cerrado con exito: ${JSON.stringify(closedTicket)} para la placa ${closedTicket.placa}`);

    // Notificar al dashboard (SSE)
    this.eventsService.emit(tenantId, {
      type: 'ticket_cerrado',
      data: {
        id: closedTicket.id,
        placa: closedTicket.placa,
        idEspacio: closedTicket.idEspacio,
        estado: 'DISPONIBLE',
        valorRecaudado: closedTicket.valorRecaudado,
      },
    });

    return closedTicket;
  }

  remove(id: string) {
    return `This action removes a #${id} ticket`;
  }

  //metodos privados
  private async validarPersona(tenantId: string, dni: string): Promise<Persona | null> {
    try {
      // Cache Redis: 1ra vez consulta ms-usuarios (MISS+SET), luego sirve de cache (HIT)
      return await this.cache.getOrSet<Persona>(tenantId, `persona:${dni}`, () =>
        this.httpClient.get<Persona>(tenantId, `${this.personaUrl}/${dni}`),
      );
    } catch (error) {
      this.logger.error(`Error al validar persona: ${error}`);
      return null;
    }
  }

  private async validarPlaca(tenantId: string, placa: string): Promise<Vehiculo | null> {
    try {
      // Cache Redis: 1ra vez consulta ms-vehiculos (MISS+SET), luego sirve de cache (HIT)
      return await this.cache.getOrSet<Vehiculo>(tenantId, `vehiculo:${placa}`, () =>
        this.httpClient.get<Vehiculo>(tenantId, `${this.vehiculoUrl}/${placa}`),
      );
    } catch (error) {
      this.logger.error(`Error al validar la placa ${placa} del vehiculo: ${error}`);
      return null;
    }
  }

  private async buscarEspacioDisponible(tenantId: string, idEspacio: string, idZona: string): Promise<Espacio | null> {
    try {
      const url = `${this.espacioUrl}/${idEspacio}`;
      const espacio = await this.httpClient.get<Espacio>(tenantId, url);

      if (!espacio || (espacio.idZona !== idZona && espacio.nombreZona !== idZona)) return null;
      if (espacio.estado !== 'DISPONIBLE') {
        throw new ConflictException(
          `El espacio no está disponible (estado: ${espacio.estado.toLowerCase()})`,
        );
      }
      return espacio;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`Error al buscar el espacio disponible ${idEspacio}: ${error}`);
      return null;
    }
  }

  private async validarTicketActivo(tenantId: string, placa: string): Promise<boolean> {
    const ticketActivo = await this.ticketRepository.findOne({
      where: { tenantId, placa, activo: true }
    });
    return !!ticketActivo;
  }

  private async validarPersonaTicketActivo(tenantId: string, dni: string): Promise<boolean> {
    const ticketActivo = await this.ticketRepository.findOne({
      where: { tenantId, dni, activo: true }
    });
    return !!ticketActivo;
  }

  private async actualizarEstadoEspacio(tenantId: string, idEspacio: string, estado: 'DISPONIBLE' | 'OCUPADO' | 'RESERVADO'): Promise<void> {
    try {
      const url = `${this.espacioUrl}/${idEspacio}/estado/${estado}`;
      await this.httpClient.patch(tenantId, url);
    } catch (error) {
      this.logger.error(`Error al actualizar estado del espacio ${idEspacio} a ${estado}: ${error}`);
      if ((error as any)?.status === 409) {
        throw new ConflictException('Espacio no disponible');
      }
      throw new BadRequestException(`No se pudo actualizar el estado del espacio: ${error}`);
    }
  }

  calcularHoras(ingreso: Date | string, salida: Date | string): number {
    const dateIngreso = typeof ingreso === 'string' ? new Date(ingreso) : ingreso;
    const dateSalida = typeof salida === 'string' ? new Date(salida) : salida;
    const diffMs = dateSalida.getTime() - dateIngreso.getTime();
    const difHoras = diffMs / (1000 * 60 * 60);
    return Math.ceil(difHoras);
  }

}
