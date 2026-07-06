import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { Repository } from 'typeorm';
import { Eventoauditoria } from './entities/audit.entity';

@Injectable()
export class AuditService {

  constructor(
    @InjectRepository(Eventoauditoria)
    private auditRepo: Repository<Eventoauditoria>
  ) { }

  async create(createAuditDto: CreateAuditDto): Promise<Eventoauditoria> {
    const newEvent = this.auditRepo.create({
      ...createAuditDto,
      timestamp: createAuditDto.fecha_hora || new Date()
    });

    return this.auditRepo.save(newEvent);
  }

  async findAll(): Promise<Eventoauditoria[]> {
    return this.auditRepo.find({ order: { timestamp: 'DESC' } });
  }

  async findOne(id: string): Promise<Eventoauditoria | null> {
    return await this.auditRepo.findOne({ where: { id: +id } });
  }

  // async update(id: string, updateAuditDto: UpdateAuditDto) {
  //   return `This action updates a #${id} audit`;
  // }

  // remove(id: number) {
  //   return `This action removes a #${id} audit`;
  // }
}
