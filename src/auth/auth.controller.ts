import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { RegisterUserDto } from 'src/users/dto/create-user.dto';
import { IUser } from 'src/types/global.constanst';
import { ResetPasswordDto, SendOtpDto, VerifyOtpDto } from './dto/otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Public()
  @Post('login')
  @ResponseMessage('Đăng nhập thành công!')
  handleLogin(@Req() req, @Res({ passthrough: true }) response) {
    return this.authService.login(req.user, response);
  }

  @Public()
  @Post('register')
  @ResponseMessage('Đăng kí thành công!')
  handleRegister(@Body() RegisterUserDto: RegisterUserDto) {
    return this.authService.register(RegisterUserDto);
  }

  @ResponseMessage('Get user information')
  @Get('account')
  getAccount(@User() user: IUser) {
    // const temp = (await this.rolesService.findOne(user.role._id)) as any;
    // user.permissions = temp?.permissions;
    return { user };
  }

  @Post('logout')
  @ResponseMessage('Đăng xuất thành công!')
  handleLogout(@User() user: IUser, @Res({ passthrough: true }) response) {
    return this.authService.logout(user, response);
  }

  @Public()
  @ResponseMessage('Get user by refresh token')
  @Get('refresh-token')
  handleRefreshToken(@Req() request, @Res({ passthrough: true }) response) {
    const refreshToken = request.cookies['refresh_token'];
    return this.authService.processNewToken(refreshToken, response);
  }

  @Public()
  @ResponseMessage('login with google')
  @Post('google')
  loginWithGoogle(@Body() payload: any, @Res({ passthrough: true }) response) {
    return this.authService.loginWithGoogle(payload, response);
  }

  @Public()
  @Post('otp/send')
  @ResponseMessage('OTP đã được gửi')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @ResponseMessage('Xác thực OTP thành công')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('reset-password')
  @ResponseMessage('Đổi mật khẩu thành công')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
