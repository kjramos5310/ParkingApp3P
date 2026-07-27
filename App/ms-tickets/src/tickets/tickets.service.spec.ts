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
});
