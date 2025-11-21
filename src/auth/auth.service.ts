import { RegisterUserDto } from './../users/dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import ms from 'ms';
import { IUser } from 'src/types/global.constanst';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  validateUser = async (username: string, password: string) => {
    const user = await this.usersService.findOneByUsername(username);
    if (user) {
      const isValid = this.usersService.isValidPassword(
        password,
        user?.password,
      );
      if (isValid === true) {
        return user;
      }
    }

    return null;
  };

  async login(user: any, response: Response) {
    const { _id, name, email, role, phone, avatar } = user;
    const payload = {
      sub: 'token login',
      iss: 'from server',
      _id,
      name,
      email,
      role,
      phone,
      avatar,
    };

    const refresh_token = this.createRefreshToken(payload);

    await this.usersService.updateRefreshToken(refresh_token, _id);

    response.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: ms(this.configService.get<number>('JWT_REFRESH_EXPIRES')!) as any,
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id,
        name,
        email,
        role,
        phone,
        avatar,
      },
    };
  }

  register = async (RegisterUserDto: RegisterUserDto) => {
    const newUser = await this.usersService.register(RegisterUserDto);

    return {
      _id: newUser._id,
      createdAt: newUser.createdAt,
    };
  };

  logout = async (user: IUser, response: Response) => {
    await this.usersService.updateRefreshToken('', user._id);
    response.clearCookie('refresh_token');
    return 'ok';
  };

  createRefreshToken = (payload) => {
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES') as any,
    });
    return refresh_token;
  };

  processNewToken = async (refreshToken: string, response: Response) => {
    try {
      this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });

      let user = await this.usersService.findUserByRefreshToken(refreshToken);

      if (user) {
        const { _id, name, email, role, phone, avatar } = user;
        const payload = {
          sub: 'refresh token',
          iss: 'from server',
          _id,
          name,
          email,
          role,
          phone,
          avatar,
        };

        const refresh_token = this.createRefreshToken(payload);

        await this.usersService.updateRefreshToken(
          refresh_token,
          _id.toString(),
        );

        const userRole = user.role as unknown as { _id: string; name: string };
        // const temp = await this.rolesService.findOne(userRole._id);

        response.clearCookie('refresh_token');

        response.cookie('refresh_token', refresh_token, {
          httpOnly: true,
          maxAge: ms(
            this.configService.get<number>('JWT_REFRESH_EXPIRES')!,
          ) as any,
        });
        return {
          access_token: this.jwtService.sign(payload),
          user: {
            _id,
            name,
            email,
            role,
            phone,
            avatar,
          },
        };
      } else {
        throw new BadRequestException('Refresh token loi');
      }
    } catch (error) {
      throw new BadRequestException('Refresh token loi');
    }
  };
}
