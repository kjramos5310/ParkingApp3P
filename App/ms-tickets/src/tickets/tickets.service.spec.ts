import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsService } from '../events/events.service';
import { HttpClientService } from './common/httpl-client.service';
import { RedisCacheService } from './common/redis-cache.service';
import { Ticket } from './entities/ticket.entity';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let repositorio: Record<string, jest.Mock>;

  const configuracion: Record<string, string> = {
    MS_PERSONAS: 'http://ms-usuarios:8080/api/personas',
    MS_ESPACIOS: 'http://ms-zonas:8082/api/espacios',
    MS_VEHICULOS: 'http://ms-vehiculos:3000/vehiculos/placa',
    TARIFA_HORA: '1.5',
  };

  beforeEach(async () => {
    repositorio = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: repositorio },
        { provide: HttpClientService, useValue: { get: jest.fn(), patch: jest.fn() } },
        { provide: ConfigService, useValue: { get: (clave: string) => configuracion[clave] } },
        { provide: EventsService, useValue: { emit: jest.fn(), publicar: jest.fn() } },
        { provide: RedisCacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('se instancia', () => {
    expect(service).toBeDefined();
  });

  it('consulta unicamente los tickets del tenant recibido', async () => {
    await service.findAll('empresa-a');

    const [argumentos] = (repositorio.find as jest.Mock).mock.calls[0] as [
      { where?: Record<string, unknown> },
    ];
    expect(argumentos.where).toMatchObject({ tenantId: 'empresa-a' });
  });

  it('lista como activos solo los tickets abiertos del tenant', async () => {
    await service.findActivos('empresa-b');

    const [argumentos] = (repositorio.find as jest.Mock).mock.calls[0] as [
      { where?: Record<string, unknown> },
    ];
    expect(argumentos.where).toMatchObject({ tenantId: 'empresa-b', activo: true });
  });

  it('rechaza con conflicto un segundo ticket activo para el mismo vehiculo', async () => {
    jest.spyOn(service as any, 'validarPersona').mockResolvedValue({ dni: '9999999999' });
    jest.spyOn(service as any, 'validarPlaca').mockResolvedValue({ placa: 'ABC-1234', tipo: 'Auto' });
    jest.spyOn(service as any, 'buscarEspacioDisponible').mockResolvedValue({
      id: 'esp-1', idZona: 'zona-1', estado: 'DISPONIBLE', tipo: 'AUTO',
    });
    (repositorio.findOne as jest.Mock).mockResolvedValueOnce({ id: 'ticket-activo' });

    await expect(service.create('empresa-a', {
      placa: 'ABC-1234', dni: '9999999999', idEspacio: 'esp-1', nombreZona: 'zona-1',
    } as any)).rejects.toMatchObject({ status: 409 });
    expect(repositorio.save).not.toHaveBeenCalled();
  });

  it('solo permite que una solicitud cierre un ticket activo', async () => {
    const ticket = {
      id: 'ticket-1', tenantId: 'empresa-a', placa: 'ABC-1234', dni: '9999999999',
      idEspacio: 'esp-1', nombreZona: 'Zona A', activo: true,
      fechaHoraIngreso: new Date(Date.now() - 3_600_000),
    } as Ticket;
    (repositorio.findOne as jest.Mock).mockResolvedValue(ticket);
    (repositorio.update as jest.Mock).mockResolvedValue({ affected: 0 });
    jest.spyOn(service as any, 'validarPlaca').mockResolvedValue({ placa: ticket.placa });
    jest.spyOn(service as any, 'actualizarEstadoEspacio').mockResolvedValue(undefined);

    await expect(service.cerrarTicket('empresa-a', ticket.id)).rejects.toMatchObject({ status: 409 });
    expect((service as any).actualizarEstadoEspacio).not.toHaveBeenCalled();
  });

  it('rechaza un espacio en mantenimiento con 409 y detalle del estado', async () => {
    const http = (service as any).httpClient;
    http.get.mockResolvedValue({
      id: 'esp-5', idZona: 'zona-1', estado: 'MANTENIMIENTO', tipo: 'AUTO',
    });

    await expect((service as any).buscarEspacioDisponible(
      'empresa-a', 'esp-5', 'zona-1',
    )).rejects.toMatchObject({ status: 409 });
  });
});
