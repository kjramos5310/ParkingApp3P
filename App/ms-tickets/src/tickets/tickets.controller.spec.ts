import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let servicio: Record<string, jest.Mock>;

  beforeEach(async () => {
    servicio = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      findActivos: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: servicio }],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('se instancia', () => {
    expect(controller).toBeDefined();
  });

  it('propaga el tenant de la cabecera al listar', async () => {
    await controller.findAll('empresa-a');

    expect(servicio.findAll).toHaveBeenCalledWith('empresa-a');
  });

  it('propaga el tenant al crear un ticket', async () => {
    const dto = { placa: 'ABC-1234', dni: '1712345678', idEspacio: 'uuid', nombreZona: 'Zona A' };

    await controller.create('empresa-b', dto);

    expect(servicio.create).toHaveBeenCalledWith('empresa-b', dto);
  });
});
