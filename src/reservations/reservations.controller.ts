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
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Public()
  @Post()
  @ResponseMessage('Create a reservation table in advance')
  create(@Body() createReservationDto: CreateReservationDto) {
    return this.reservationsService.create(createReservationDto);
  }

  @Get()
  @ResponseMessage('Fetch reservation table with pagination')
  @Public()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.reservationsService.findAll(+currentPage, +limit, qs);
  }

  @Get(':id')
  @ResponseMessage('Fetch reservation table by id')
  findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Update a reservation table')
  update(
    @Param('id') id: string,
    @Body() updateReservationDto: UpdateReservationDto,
    @User() user: IUser,
  ) {
    return this.reservationsService.update(id, updateReservationDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Delete a reservation table')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.reservationsService.remove(id, user);
  }

  @Public()
  @Post('pre-booked-table')
  @ResponseMessage('Fetch table in advance')
  getPreBookedTable() {
    return this.reservationsService.getPreBookedTable();
  }

  @Post('pre-booked-table-upcoming')
  @ResponseMessage('Fetch table in advance')
  getPreBookedTableUpComing(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.reservationsService.getPreBookedTableUpComing(
      +currentPage,
      +limit,
      qs,
    );
  }

  @Post('check-in-table')
  @ResponseMessage('check in table in advance')
  checkInTable(@Body('reservationId') reservationId: string) {
    return this.reservationsService.checkInTable(reservationId);
  }

  @Post('cancel-reservation')
  @ResponseMessage('cancel table in advance')
  cancelTableReservation(@Body('reservationId') reservationId: string) {
    return this.reservationsService.cancelTableReservation(reservationId);
  }

  @Public()
  @Post('valid-reservation')
  validateReservation(
    @Body('date') date: string,
    @Body('timeSlot') timeSlot: string,
    @Body('tableId') tableId: string,
  ) {
    return this.reservationsService.validateReservation(
      date,
      timeSlot,
      tableId,
    );
  }

  @Post('data-in-status')
  @ResponseMessage('Fetch reservation data in status')
  fetchReservationDataInStatus(
    @Body('status') status: string,
    @Body('customerPhone') customerPhone: string,
  ) {
    return this.reservationsService.fetchReservationDataInStatus(
      status,
      customerPhone,
    );
  }
}
