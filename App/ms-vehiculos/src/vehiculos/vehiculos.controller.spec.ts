import { Test, TestingModule } from '@nestjs/testing';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

describe('VehiculosController', () => {
  let controller: VehiculosController;
  let servicio: Record<string, jest.Mock>;

  beforeEach(async () => {
    servicio = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findByPlaca: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehiculosController],
      providers: [{ provide: VehiculosService, useValue: servicio }],
    }).compile();

    controller = module.get<VehiculosController>(VehiculosController);
  });

  it('se instancia', () => {
    expect(controller).toBeDefined();
  });

  it('propaga el tenant de la cabecera al servicio', async () => {
    await controller.findAll('empresa-a');

    expect(servicio.findAll).toHaveBeenCalledWith('empresa-a');
  });
});
