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
      remove: jest.fn(),
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

      await expect(service.create('empresa-a', dto)).rejects.toThrow('La placa ya está registrada en este tenant');
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

  describe('CRUD multitenant', () => {
    const existente = {
      id: 'veh-1',
      tenantId: 'empresa-a',
      placa: 'ABC-1234',
      marca: 'Toyota',
      modelo: 'Corolla',
      color: 'Blanco',
    } as any;

    it('actualiza dentro del tenant y publica auditoria', async () => {
      (repositorio.findOne as jest.Mock)
        .mockResolvedValueOnce(existente)
        .mockResolvedValueOnce(null);
      (repositorio.save as jest.Mock).mockImplementation(async (vehiculo) => vehiculo);

      const actualizado = await service.update('empresa-a', 'veh-1', {
        datos: { ...existente, placa: 'DEF-5678', color: 'Negro' },
      } as any);

      expect(actualizado.placa).toBe('DEF-5678');
      expect(repositorio.findOne).toHaveBeenCalledWith({
        where: { tenantId: 'empresa-a', id: 'veh-1' },
      });
      expect(publicador.publishAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'update', tenant_id: 'empresa-a' }),
      );
    });

    it('elimina unicamente el vehiculo del tenant y audita', async () => {
      (repositorio.findOne as jest.Mock).mockResolvedValue({ ...existente });

      await service.remove('empresa-a', 'veh-1');

      expect(repositorio.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'veh-1' }));
      expect(publicador.publishAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'delete', tenant_id: 'empresa-a' }),
      );
    });
  });
});
