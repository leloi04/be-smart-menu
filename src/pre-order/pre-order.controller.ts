import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PreOrderService } from './pre-order.service';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { UpdatePreOrderDto } from './dto/update-pre-order.dto';

@Controller('pre-order')
export class PreOrderController {
  constructor(private readonly preOrderService: PreOrderService) {}

  @Post()
  create(@Body() createPreOrderDto: CreatePreOrderDto) {
    return this.preOrderService.create(createPreOrderDto);
  }

  @Get()
  findAll() {
    return this.preOrderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.preOrderService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePreOrderDto: UpdatePreOrderDto) {
    return this.preOrderService.update(+id, updatePreOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.preOrderService.remove(+id);
  }
}
