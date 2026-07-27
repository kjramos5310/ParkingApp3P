import { Controller, Get, Post, Body, Patch, Param, Delete, Headers } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';

@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  create(@Headers('x-tenant-id') tenantId: string, @Body() createVehiculoDto: CreateVehiculoDto) {
    return this.vehiculosService.create(tenantId, createVehiculoDto);
  }

  @Get()
  findAll(@Headers('x-tenant-id') tenantId: string) {
    return this.vehiculosService.findAll(tenantId);
  }

  @Get('placa/:placa')
  findByPlaca(@Headers('x-tenant-id') tenantId: string, @Param('placa') placa: string) {
    return this.vehiculosService.findByPlaca(tenantId, placa);
  }

  @Get(':id')
  findOne(@Headers('x-tenant-id') tenantId: string, @Param('id') id: string) {
    return this.vehiculosService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVehiculoDto: UpdateVehiculoDto) {
    return this.vehiculosService.update(id, updateVehiculoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vehiculosService.remove(id);
  }
}
