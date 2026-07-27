import { Controller, Get, Post, Body, Patch, Param, Delete, Headers } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Headers('x-tenant-id') tenantId: string, @Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(tenantId, createTicketDto);
  }

  @Get()
  findAll(@Headers('x-tenant-id') tenantId: string) {
    return this.ticketsService.findAll(tenantId);
  }

  @Get('activos')
  findActivos(@Headers('x-tenant-id') tenantId: string) {
    return this.ticketsService.findActivos(tenantId);
  }

  @Get(':id')
  findOne(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    return this.ticketsService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketsService.update(tenantId, id, updateTicketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(id);
  }
}
