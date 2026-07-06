import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('audit')
@UseGuards(ThrottlerGuard)
// @UseInterceptors(ThrottlerGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  @Post()
  create(@Body() createAuditDto: CreateAuditDto) {
    return this.auditService.create(createAuditDto);
  }

  @Get()
  findAll() {
    return this.auditService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }



}
