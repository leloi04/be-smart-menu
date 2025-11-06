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
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Public()
  @ResponseMessage('Create a new order')
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  @Get()
  @ResponseMessage('Fetch order with pagination')
  @Public()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.orderService.findAll(+currentPage, +limit, qs);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Fetch order item by id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Public()
  @Patch(':id')
  @ResponseMessage('Update a order')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.orderService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @ResponseMessage('Delete a order')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.orderService.remove(id, user);
  }

  @Public()
  @Post('/current-order')
  @ResponseMessage('Get current order by tableId')
  getOrderByTable(@Body('tableId') tableId: string) {
    return this.orderService.getOrderByTable(tableId);
  }

  @Public()
  @Post('/add-customer')
  @ResponseMessage('add customer to order by tableId')
  addCustomerToOrder(
    @Body('orderId') orderId: string,
    @Body('userId') userId: string,
    @Body('name') name: string,
    @Body('isGuest') isGuest: boolean,
  ) {
    const customer = { userId, name, isGuest };
    return this.orderService.addCustomerToOrder(orderId, customer);
  }

  @Public()
  @Post('/status-changed')
  @ResponseMessage('Change status')
  changedStatus(
    @Body('tableNumber') tableNumber: string,
    @Body('orderId') orderId: string,
    @Body('status') status: string,
  ) {
    return this.orderService.changedStatus(tableNumber, orderId, status);
  }
}
