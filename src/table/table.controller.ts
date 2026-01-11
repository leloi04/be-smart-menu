import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { TableService } from './table.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('tables')
export class TableController {
  constructor(private readonly tableService: TableService) {}

  @Post()
  @ResponseMessage('Create a new table')
  create(@Body() createTableDto: CreateTableDto, @User() user: IUser) {
    return this.tableService.create(createTableDto, user);
  }

  @Get()
  @ResponseMessage('Fetch table with pagination')
  @Public()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.tableService.findAll(+currentPage, +limit, qs);
  }

  @Public()
  @Get(':id')
  @ResponseMessage('Fetch table by id')
  findOne(@Param('id') id: string) {
    return this.tableService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Update a table')
  update(
    @Param('id') id: string,
    @Body() updateTableDto: UpdateTableDto,
    @User() user: IUser,
  ) {
    return this.tableService.update(id, updateTableDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Delete a table')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.tableService.remove(id, user);
  }

  @Public()
  @Post('by-token')
  async getTableByToken(@Body('token') token: string) {
    return this.tableService.findByToken(token);
  }

  @Public()
  @Post('verify-token')
  async verifyToken(@Body('token') token: string) {
    const table = await this.tableService.findByToken(token);
    if (!table) throw new NotFoundException('Token không hợp lệ');
    return {
      tableId: table._id,
      tableNumber: table.tableNumber,
    };
  }

  @Public()
  @Post('data')
  @ResponseMessage('Fetch all table')
  getAllTable() {
    return this.tableService.getAllTable();
  }

  @Public()
  @Post('change-status')
  @ResponseMessage('Change status for table')
  handleChangeStatusTable(
    @Body('tableId') tableId: string,
    @Body('status') status: string,
  ) {
    return this.tableService.handleChangeStatusTable(tableId, status);
  }
}
