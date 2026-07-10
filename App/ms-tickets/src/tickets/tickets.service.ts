import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { TicketsEventsService } from '../events/events.service';

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
    private readonly eventsService: TicketsEventsService,
  ) {
    this.personaUrl = configService.get<string>('MS_PERSONAS') || 'http://localhost:8080/api/personas';
    this.espacioUrl = configService.get<string>('MS_ESPACIOS') || 'http://localhost:8080/api/espacios';
    this.vehiculoUrl = configService.get<string>('MS_VEHICULOS') || 'http://localhost:8080/api/vehiculos';
    this.tarifaPorHora = parseFloat(configService.get<string>('TARIFA_HORA') || '1.0');
  }

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    // 1 validar persona
    const persona = await this.validarPersona(createTicketDto.dni);
    if (!persona) throw new BadRequestException('Persona no encontrada');

    // 2 valido placa
    const vehiculo = await this.validarPlaca(createTicketDto.placa);
    if (!vehiculo) throw new BadRequestException('Vehiculo no encontrado');

    // 3 buscar espacio disponible
    const espacio = await this.buscarEspacioDisponible(createTicketDto.idEspacio, createTicketDto.nombreZona);
    if (!espacio) throw new BadRequestException('Espacio no encontrado o no disponible');

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
    const tieneTicketActivo = await this.validarTicketActivo(createTicketDto.placa);
    if (tieneTicketActivo) {
      throw new BadRequestException('El vehiculo ya tiene un ticket activo');
    }
    const tienePersonaTicketActivo = await this.validarPersonaTicketActivo(createTicketDto.dni);
    if (tienePersonaTicketActivo) {
      throw new BadRequestException('La persona ya tiene un ticket activo');
    }

    // 5 generar ticket
    const ticket = this.ticketRepository.create({
      ...createTicketDto,
      fechaHoraIngreso: new Date(),
      activo: true,
      valorRecaudado: 0,
    });

    const TicketGuardado = await this.ticketRepository.save(ticket);
    
    // Cambiar de estado al espacio a OCUPADO
    await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'OCUPADO');

    // Notificar a los clientes SSE (dashboard) del cambio de estado
    this.eventsService.emit({
      type: 'espacio_actualizado',
      data: {
        idEspacio: createTicketDto.idEspacio,
        estado: 'OCUPADO',
        nombre: (espacio as any)?.nombre,
        placa: createTicketDto.placa,
        ticketId: TicketGuardado.id,
      },
    });

    this.logger.log(`Ticket creado con exito: ${JSON.stringify(TicketGuardado)} para la placa ${createTicketDto.placa}`);
    return TicketGuardado;
  }

  async findAll(): Promise<Ticket[]> {
    return this.ticketRepository.find({ order: { fechaHoraIngreso: 'DESC' } });
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });

    if (!ticket) {
      throw new BadRequestException("Ticket no encontrado");
    }

    return ticket;
  }

  async findActivos(): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { activo: true },
      order: { fechaHoraIngreso: 'DESC' }
    });
  }

  async update(id: string, updateTicketDto?: UpdateTicketDto): Promise<Ticket> {
    return this.cerrarTicket(id, updateTicketDto);
  }

  async cerrarTicket(id: string, updateTicketDto?: UpdateTicketDto): Promise<Ticket> {
    //1 buscar ticket
    const ticket = await this.findOne(id);
    //2 validar ticket
    if (!ticket) {
      throw new BadRequestException("Ticket no encontrado");
    }
    //3 cerrar ticket
    ticket.activo = false;
    ticket.fechaHoraSalida = new Date();

    //4 calcular valor recaudado
    const horas = this.calcularHoras(ticket.fechaHoraIngreso, ticket.fechaHoraSalida);
    let costo = horas * this.tarifaPorHora;

    // APLICAR DESCUENTO ECOLOGICO (REGLA DE NEGOCIO)
    const vehiculo = await this.validarPlaca(ticket.placa);
    if (vehiculo && (
      vehiculo.clasificacion === 'ELECTRICO' ||
      vehiculo.clasificacion === 'HIBRIDO' ||
      vehiculo.clasificacion === 'HIBRIDO_ENCHUFABLE'
    )) {
      costo = costo * 0.5;
      this.logger.log(`Se aplico un descuento del 50% por vehiculo ecologico (${vehiculo.clasificacion}) para placa ${ticket.placa}`);
    }

    ticket.valorRecaudado = updateTicketDto?.valorRecaudado ?? costo;

    // Actualizar estado del espacio a DISPONIBLE
    await this.actualizarEstadoEspacio(ticket.idEspacio, 'DISPONIBLE');

    // Notificar a los clientes SSE (dashboard) del cambio de estado
    this.eventsService.emit({
      type: 'espacio_actualizado',
      data: {
        idEspacio: ticket.idEspacio,
        estado: 'DISPONIBLE',
        placa: ticket.placa,
        ticketId: ticket.id,
      },
    });

    const closedTicket = await this.ticketRepository.save(ticket);
    this.logger.log(`Ticket cerrado con exito: ${JSON.stringify(closedTicket)} para la placa ${closedTicket.placa}`);
    return closedTicket;
  }

  remove(id: string) {
    return `This action removes a #${id} ticket`;
  }

  //metodos privados
  private async validarPersona(dni: string): Promise<Persona | null> {
    try {
      const url = `${this.personaUrl}/${dni}`;
      const persona = await this.httpClient.get<Persona>(url);
      return persona;
    } catch (error) {
      this.logger.error(`Error al validar persona: ${error}`);
      return null;
    }
  }

  private async validarPlaca(placa: string): Promise<Vehiculo | null> {
    try {
      const url = `${this.vehiculoUrl}/${placa}`;
      const vehiculo = await this.httpClient.get<Vehiculo>(url);
      return vehiculo;
    } catch (error) {
      this.logger.error(`Error al validar la placa ${placa} del vehiculo: ${error}`);
      return null;
    }
  }

  private async buscarEspacioDisponible(idEspacio: string, idZona: string): Promise<Espacio | null> {
    try {
      const url = `${this.espacioUrl}/${idEspacio}`;
      const espacio = await this.httpClient.get<Espacio>(url);

      if (espacio && (espacio.idZona === idZona || espacio.nombreZona === idZona) && espacio.estado === 'DISPONIBLE') {
        return espacio;
      }
      return null;
    } catch (error) {
      this.logger.error(`Error al buscar el espacio disponible ${idEspacio}: ${error}`);
      return null;
    }
  }

  private async validarTicketActivo(placa: string): Promise<boolean> {
    const ticketActivo = await this.ticketRepository.findOne({
      where: { placa, activo: true }
    });
    return !!ticketActivo;
  }

  private async validarPersonaTicketActivo(dni: string): Promise<boolean> {
    const ticketActivo = await this.ticketRepository.findOne({
      where: { dni, activo: true }
    });
    return !!ticketActivo;
  }

  private async actualizarEstadoEspacio(idEspacio: string, estado: 'DISPONIBLE' | 'OCUPADO' | 'RESERVADO'): Promise<void> {
    try {
      const url = `${this.espacioUrl}/${idEspacio}/estado/${estado}`;
      await this.httpClient.patch(url);
    } catch (error) {
      this.logger.error(`Error al actualizar estado del espacio ${idEspacio} a ${estado}: ${error}`);
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
