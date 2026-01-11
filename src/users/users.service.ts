import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
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
import { ACCOUNT_SEED_DATA } from 'src/types/data.seed';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectModel(User.name)
    private UserModel: SoftDeleteModel<UserDocument>,

    @InjectModel(Role.name)
    private RoleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  async onModuleInit() {
    await this.seedUser();
  }

  async seedUser() {
    const count = await this.UserModel.countDocuments();

    if (count > 0) {
      this.logger.log('👤 User collection đã có dữ liệu → bỏ qua seed');
      return;
    }

    this.logger.log('🌱 User collection trống → insertMany user');

    await this.UserModel.insertMany(ACCOUNT_SEED_DATA);

    this.logger.log('✅ Seed user thành công');
  }

  async create(createUserDto: CreateUserDto, user: IUser) {
    const { email, role, phone } = createUserDto;
    const { password } = createUserDto;
    const salt = genSaltSync(10);
    const hashPassword = hashSync(password, salt);

    const isExistEmail = await this.UserModel.findOne({ email });
    if (isExistEmail) {
      throw new BadRequestException(`email ${email} nay da ton tai`);
    }
    const isExistPhone = await this.UserModel.findOne({ phone });
    if (isExistPhone) {
      throw new BadRequestException(`sđt ${phone} đã có người sử dụng!`);
    }

    const newUser = await this.UserModel.create({
      ...createUserDto,
      role: role ?? new mongoose.Types.ObjectId(CUSTOMER_ROLE_ID),
      password: hashPassword,
      createdBy: {
        _id: user?._id,
        email: user?.email,
      },
    });

    return {
      _id: newUser._id,
      createdAt: newUser.createdAt,
    };
  }

  async register(RegisterUserDto: RegisterUserDto) {
    const { email, phone } = RegisterUserDto;
    const { password } = RegisterUserDto;
    const salt = genSaltSync(10);
    const hashPassword = hashSync(password, salt);

    const isExistEmail = await this.UserModel.findOne({ email });
    if (isExistEmail) {
      throw new BadRequestException(`email ${email} nay da ton tai`);
    }
    const isExistPhone = await this.UserModel.findOne({ phone });
    if (isExistPhone) {
      throw new BadRequestException(`sđt ${phone} đã có người sử dụng!`);
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
    return await this.UserModel.findOne({ refreshToken }).populate({
      path: 'role',
      select: { name: 1 },
    });
  };

  async update(id: string, updateUserDto: UpdateUserDto, user: IUser) {
    const { email, phone } = updateUserDto;
    const userData = await this.UserModel.findById(id);
    const iExistEmail = await this.UserModel.findOne({ email });
    if (iExistEmail && email !== userData?.email) {
      throw new BadRequestException(`email ${email} nay da ton tai`);
    }
    const isExistPhone = await this.UserModel.findOne({ phone });
    if (isExistPhone && phone.toString() !== userData?.phone.toString()) {
      throw new BadRequestException(`sđt ${phone} đã có người sử dụng!`);
    }
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

  async findByEmail(email: string) {
    return this.UserModel.findOne({ email }).populate({
      path: 'role',
      select: { name: 1 },
    });
  }

  async createFromGoogle(data: {
    email: string;
    name: string;
    avatar: string;
    googleId: string;
    phone: string;
  }) {
    const user = await this.UserModel.create({
      email: data.email,
      name: data.name,
      role: new mongoose.Types.ObjectId(CUSTOMER_ROLE_ID),
      avatar: data.avatar,
      googleId: data.googleId,
      providers: ['google'],
      phone: data.phone,
    });

    return this.UserModel.findById(user._id).populate({
      path: 'role',
      select: { name: 1 },
    });
  }

  async handleCheckedPhone(email: string) {
    const user = this.UserModel.findOne({ email });
    return user;
  }

  async handleCheckValidPhone(phone: string) {
    const user = this.UserModel.findOne({ phone });
    return user;
  }

  async forgetPassword(email: string, password: string) {
    await this.UserModel.findOneAndUpdate(
      { email },
      {
        password,
      },
    );
  }
}
