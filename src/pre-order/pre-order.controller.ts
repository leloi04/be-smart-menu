import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PreOrderService } from './pre-order.service';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { UpdatePreOrderDto } from './dto/update-pre-order.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('pre-order')
export class PreOrderController {
  constructor(private readonly preOrderService: PreOrderService) {}

  @Post()
  @ResponseMessage('Create a new pre-order')
  create(@Body() createPreOrderDto: CreatePreOrderDto, @User() user: IUser) {
    return this.preOrderService.create(createPreOrderDto, user);
  }

  @Get()
  @ResponseMessage('Fetch menu with pagination')
  @Public()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.preOrderService.findAll(+currentPage, +limit, qs);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Fetch pre-order by id')
  findOne(@Param('id') id: string) {
    return this.preOrderService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Update a pre-order')
  update(
    @Param('id') id: string,
    @Body() updatePreOrderDto: UpdatePreOrderDto,
    @User() user: IUser,
  ) {
    return this.preOrderService.update(id, updatePreOrderDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Delete a pre-order')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.preOrderService.remove(id, user);
  }
}
