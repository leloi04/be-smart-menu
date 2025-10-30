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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ResponseMessage('Create a role')
  @Post()
  create(@Body() createRoleDto: CreateRoleDto, @User() user: IUser) {
    return this.rolesService.create(createRoleDto, user);
  }

  @ResponseMessage('Fetch roles with paginate')
  @Get()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.rolesService.findAll(+currentPage, +limit, qs);
  }

  @ResponseMessage('Fetch role by id')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @ResponseMessage('Update a role')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @User() user: IUser,
  ) {
    return this.rolesService.update(id, updateRoleDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.rolesService.remove(id, user);
  }
}
