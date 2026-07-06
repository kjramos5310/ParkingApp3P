// import { Module } from '@nestjs/common';
// import { VehiculosService } from './vehiculos.service';
// import { VehiculosController } from './vehiculos.controller';

// @Module({
//   controllers: [VehiculosController],
//   providers: [VehiculosService],
// })
// export class VehiculosModule {}

import { Module } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { VehiculosController } from './vehiculos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { Auto } from './entities/auto.entity';
import { Motocicleta } from './entities/motocicleta.entity';
import { Camioneta } from './entities/camioneta.entity';
import { EventPublisher } from '../common/event.publisher.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from '../common/interceptors/audit.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Vehiculo, Auto, Motocicleta, Camioneta])],
  controllers: [VehiculosController],
  providers: [
    VehiculosService,
    EventPublisher,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [VehiculosService],
})
export class VehiculosModule { }