import { Controller, Get, Post, Body, Param, UseGuards, Headers } from '@nestjs/common';
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
  create(@Headers('x-tenant-id') tenantId: string, @Body() createAuditDto: CreateAuditDto) {
    createAuditDto.tenant_id = tenantId;
    return this.auditService.create(createAuditDto);
  }

  @Get()
  findAll(@Headers('x-tenant-id') tenantId: string) {
    return this.auditService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    return this.auditService.findOne(tenantId, id);
  }



}
