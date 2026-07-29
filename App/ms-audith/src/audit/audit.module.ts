import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Eventoauditoria } from './entities/audit.entity';
import { AuditConsumer } from './entities/audit.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Eventoauditoria])],
  controllers: [AuditController],
  providers: [AuditService, AuditConsumer],
})
export class AuditModule { }
