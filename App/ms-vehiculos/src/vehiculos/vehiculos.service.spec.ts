import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventPublisher } from '../common/event.publisher.service';
import { Vehiculo } from './entities/vehiculo.entity';
import { VehiculosService } from './vehiculos.service';

describe('VehiculosService', () => {
  let service: VehiculosService;
  let repositorio: jest.Mocked<Partial<Repository<Vehiculo>>>;
  let publicador: { publishAuditEvent: jest.Mock };

  beforeEach(async () => {
    repositorio = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    publicador = { publishAuditEvent: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiculosService,
        { provide: getRepositoryToken(Vehiculo), useValue: repositorio },
        { provide: EventPublisher, useValue: publicador },
      ],
    }).compile();

    service = module.get<VehiculosService>(VehiculosService);
  });

  it('se instancia', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('filtra por tenant para no exponer vehiculos de otra empresa', async () => {
      (repositorio.find as jest.Mock).mockResolvedValue([]);

      await service.findAll('empresa-a');

      expect(repositorio.find).toHaveBeenCalledWith({ where: { tenantId: 'empresa-a' } });
    });
  });

  describe('create', () => {
    const dto = {
      tipo: 'Auto',
      datos: {
        marca: 'Toyota',
        placa: 'ABC-1234',
        modelo: 'Corolla',
        color: 'Blanco',
        anio: 2020,
        numeroPuertas: 4,
        capacidadMaletero: 3,
      },
    } as any;

    it('rechaza una placa ya registrada en el mismo tenant', async () => {
      (repositorio.findOne as jest.Mock).mockResolvedValue({ id: 'existente' });

      await expect(service.create('empresa-a', dto)).rejects.toThrow('ABC-1234');
      expect(repositorio.save).not.toHaveBeenCalled();
    });

    it('asigna el tenant y publica el evento de auditoria', async () => {
      (repositorio.findOne as jest.Mock).mockResolvedValue(null);
      (repositorio.save as jest.Mock).mockImplementation((vehiculo) =>
        Promise.resolve({ ...vehiculo, id: 'nuevo-id' }),
      );

      const creado = await service.create('empresa-a', dto);

      expect(creado?.tenantId).toBe('empresa-a');
      expect(publicador.publishAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          servicio: 'ms-vehiculos',
          tenant_id: 'empresa-a',
          entidad: 'vehiculo',
        }),
      );
    });
  });
});
