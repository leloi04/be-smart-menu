import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserPassword } from './dto/update-user.dto';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { compareSync, genSaltSync, hashSync } from 'bcryptjs';
import aqp from 'api-query-params';
import { Role, RoleDocument } from 'src/roles/Schemas/role.schema';
import {
  CUSTOMER_ROLE,
  CUSTOMER_ROLE_ID,
  IUser,
} from 'src/types/global.constanst';
import mongoose from 'mongoose';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private UserModel: SoftDeleteModel<UserDocument>,

    @InjectModel(Role.name)
    private RoleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  async create(createUserDto: CreateUserDto, user: IUser) {
    const { email, role } = createUserDto;
    const { password } = createUserDto;
    const salt = genSaltSync(10);
    const hashPassword = hashSync(password, salt);

    const isExist = await this.UserModel.findOne({ email });
    if (isExist) {
      throw new BadRequestException(`email ${email} nay da ton tai`);
    }

    const newUser = await this.UserModel.create({
      ...createUserDto,
      role: role ?? new mongoose.Types.ObjectId(CUSTOMER_ROLE_ID),
      password: hashPassword,
      // createdBy: {
      //   _id: user?._id,
      //   email: user?.email,
      // },
    });

    return {
      _id: newUser._id,
      createdAt: newUser.createdAt,
    };
  }

  async register(RegisterUserDto: RegisterUserDto) {
    const { email } = RegisterUserDto;
    const { password } = RegisterUserDto;
    const salt = genSaltSync(10);
    const hashPassword = hashSync(password, salt);

    const isExist = await this.UserModel.findOne({ email });
    if (isExist) {
      throw new BadRequestException(`email ${email} nay da ton tai`);
    }
    const user = await this.UserModel.create({
      ...RegisterUserDto,
      role: new mongoose.Types.ObjectId(CUSTOMER_ROLE_ID),
      password: hashPassword,
    });

    return {
      _id: user._id,
      createdAt: user.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;
    let offset = (currentPage - 1) * +limit;
    let defaultLimit = limit ? limit : 10;
    const totalItems = (await this.UserModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.UserModel.find(filter)
      .select(['-password', '-refreshToken', '-absent'])
      .skip(offset)
      .limit(defaultLimit)
      // @ts-ignore: Unreachable code error
      .sort(sort as any)
      .populate(population)
      .populate({ path: 'role', select: { name: 1 } })
      .exec();

    return {
      meta: {
        current: currentPage, //trang hiện tại
        pageSize: limit, //số lượng bản ghi đã lấy
        pages: totalPages, //tổng số trang với điều kiện query
        total: totalItems, // tổng số phần tử (số bản ghi)
      },
      result, //kết quả query
    };
  }

  async findOne(id: string) {
    const user = await this.UserModel.findById({ _id: id })
      .populate({ path: 'role', select: { name: 1, _id: 1 } })
      .populate({ path: 'children', select: { name: 1, _id: 1 } })
      .populate({ path: 'parent', select: { name: 1, _id: 1 } })
      .select('-password');
    return user;
  }

  findOneByUsername = async (username: string) => {
    return this.UserModel.findOne({ email: username }).populate({
      path: 'role',
      select: { name: 1 },
    });
  };

  isValidPassword(password: string, hashPassword: string) {
    return compareSync(password, hashPassword);
  }

  async updateRefreshToken(refresh_token: string, _id: string) {
    return await this.UserModel.updateOne(
      { _id },
      {
        refreshToken: refresh_token,
      },
    );
  }

  findUserByRefreshToken = async (refreshToken: string) => {
    return await this.UserModel.findOne({ refreshToken });
  };

  async update(id: string, updateUserDto: UpdateUserDto, user: IUser) {
    return await this.UserModel.updateOne(
      { _id: id },
      {
        ...updateUserDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    await this.UserModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return this.UserModel.softDelete({ _id: id });
  }
  async updatePassword(updateUserPassword: UpdateUserPassword, user: IUser) {
    const { newPassword, oldPassword, email } = updateUserPassword;
    const userData = await this.UserModel.findOne({ email: email });
    if (!compareSync(oldPassword, userData?.password!)) {
      throw new BadRequestException(
        'Mật khẩu cũ không đúng vui lòng nhập lại mật khẩu cũ!',
      );
    }

    const salt = genSaltSync(10);
    const hashNewPassword = hashSync(newPassword, salt);
    return await this.UserModel.updateOne(
      { email: email },
      {
        email,
        password: hashNewPassword,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }
}
