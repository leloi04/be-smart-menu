import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Role, RoleDocument } from './Schemas/role.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import aqp from 'api-query-params';
import { ADMIN_ROLE, IUser } from 'src/types/global.constanst';
import { ROLE_SEED_DATA } from 'src/types/data.seed';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);
  constructor(
    @InjectModel(Role.name) private RoleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  async onModuleInit() {
    await this.seedRole();
  }

  async seedRole() {
    const count = await this.RoleModel.countDocuments();

    if (count > 0) {
      this.logger.log('👤 role collection đã có dữ liệu → bỏ qua seed');
      return;
    }

    this.logger.log('🌱 role collection trống → insertMany role');

    await this.RoleModel.insertMany(ROLE_SEED_DATA);

    this.logger.log('✅ Seed role thành công');
  }

  async create(createRoleDto: CreateRoleDto, user: IUser) {
    const { name } = createRoleDto;
    const isExistRole = await this.RoleModel.findOne({ name });
    if (isExistRole !== null) {
      throw new BadRequestException(`Role ${name} da ton tai`);
    }
    const res = await this.RoleModel.create({
      ...createRoleDto,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });

    return {
      _id: res.id,
      createdAt: res.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;
    let offset = (currentPage - 1) * limit;
    let defaultLimit = limit ? limit : 10;
    const totalItems = (await this.RoleModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.RoleModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      // @ts-ignore: Unreachable code error
      .sort(sort as any)
      .populate({
        path: 'permissions',
        select: { _id: 1, name: 1, apiPath: 1, method: 1 },
      })
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
    return (await this.RoleModel.findById(id))?.populate({
      path: 'permissions',
      select: { _id: 1, name: 1, apiPath: 1, method: 1, module: 1 },
    });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, user: IUser) {
    const { name } = updateRoleDto;
    const isExist = await this.RoleModel.findOne({ name, _id: { $ne: id } });
    if (isExist) {
      throw new BadRequestException('Role nay da ton tai');
    }
    return await this.RoleModel.updateOne(
      { _id: id },
      {
        ...updateRoleDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    const res = await this.RoleModel.findById(id);
    if (res?.name == ADMIN_ROLE) {
      throw new BadRequestException('Day la Role ADMIN khong the xoa');
    }
    await this.RoleModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.RoleModel.softDelete({ _id: id });
  }
}
