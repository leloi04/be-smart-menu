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
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';
import { MenuGateway } from './menu.gateway';

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly menuGateway: MenuGateway,
  ) {}

  @Post()
  @ResponseMessage('Create a new menu item')
  create(@Body() createMenuDto: CreateMenuDto, @User() user: IUser) {
    return this.menuService.create(createMenuDto, user);
  }

  @Get()
  @ResponseMessage('Fetch menu with pagination')
  @Public()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.menuService.findAll(+currentPage, +limit, qs);
  }

  @Get(':id')
  @ResponseMessage('Fetch menu item by id')
  findOne(@Param('id') id: string) {
    return this.menuService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Update a menu item')
  update(
    @Param('id') id: string,
    @Body() updateMenuDto: UpdateMenuDto,
    @User() user: IUser,
  ) {
    return this.menuService.update(id, updateMenuDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Delete a menu item')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.menuService.remove(id, user);
  }

  // Cập nhật trạng thái món ăn (available / out_of_stock)
  @Patch(':id/status')
  @ResponseMessage('Update status menu item')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'available' | 'out_of_stock',
  ) {
    const updatedItem = await this.menuService.updateStatus(id, status);
    this.menuGateway.emitMenuUpdate(updatedItem); // 🔥 Phát realtime
    return { success: true, updatedItem };
  }
}
