import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { Vehiculo } from './vehiculos/entities/vehiculo.entity';
import { Auto } from './vehiculos/entities/auto.entity';
import { Motocicleta } from './vehiculos/entities/motocicleta.entity';
import { Camioneta } from './vehiculos/entities/camioneta.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST') || '127.0.0.1',
        port: +config.get('DB_PORT') || 5432,
        username: config.get<string>('DB_USUARIO') || 'postgres',
        password: config.get<string>('DB_CONTRASENA') || 'postgres',
        database: config.get<string>('DB_NOMBRE') || 'vehiculos_db',
        entities: [Vehiculo, Auto, Motocicleta, Camioneta],
        synchronize: true,
        logging: true,
      }),
      inject: [ConfigService],
    }),
    VehiculosModule,
  ],
})
export class AppModule {}
