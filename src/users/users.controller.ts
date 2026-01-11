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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserPassword } from './dto/update-user.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ResponseMessage('Create a new User')
  @Post()
  create(@Body() createUserDto: CreateUserDto, @User() user: IUser) {
    return this.usersService.create(createUserDto, user);
  }

  @Get()
  @Public()
  @ResponseMessage('Fetch users with paginate')
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.usersService.findAll(+currentPage, +limit, qs);
  }

  @Get(':id')
  @ResponseMessage('Fetch user by id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Update a User')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @User() user: IUser,
  ) {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Delete a User')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.usersService.remove(id, user);
  }

  @Post('update-password')
  @ResponseMessage('Update password')
  handleUpdatePassword(
    @Body() updateUserPassword: UpdateUserPassword,
    @User() user: IUser,
  ) {
    return this.usersService.updatePassword(updateUserPassword, user);
  }

  @Public()
  @Post('check-phone')
  @ResponseMessage('Check phone')
  handleCheckedPhone(@Body('email') email: string) {
    return this.usersService.handleCheckedPhone(email);
  }

  @Public()
  @Post('valid-phone')
  @ResponseMessage('Check phone')
  handleCheckValidPhone(@Body('phone') phone: string) {
    return this.usersService.handleCheckValidPhone(phone);
  }
}
