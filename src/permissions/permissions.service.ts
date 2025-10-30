import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import aqp from 'api-query-params';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Permission, PermissionDocument } from './Schemas/permission.schema';
import { IUser } from 'src/types/global.constanst';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name)
    private PermissionModel: SoftDeleteModel<PermissionDocument>,
  ) {}

  async create(createPermissionDto: CreatePermissionDto, user: IUser) {
    const { apiPath, method, module, name } = createPermissionDto;
    const isExist = await this.PermissionModel.find({
      apiPath,
      module,
      method,
    });
    if (isExist.length > 0) {
      throw new BadRequestException(
        `duong link ${apiPath} voi method la ${method} da ton tai`,
      );
    }
    const res = await this.PermissionModel.create({
      apiPath,
      method,
      module,
      name,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    return {
      _id: res._id,
      createdAt: res.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;
    let offset = (currentPage - 1) * limit;
    let defaultLimit = limit ? limit : 10;
    const totalItems = (await this.PermissionModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.PermissionModel.find(filter)
      .skip(offset)
      .limit(defaultLimit)
      // @ts-ignore: Unreachable code error
      .sort(sort as any)
      .populate(population)
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
    return await this.PermissionModel.findById(id);
  }

  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
    user: IUser,
  ) {
    const { apiPath, method, module, name } = updatePermissionDto;
    const isExistApiPath = await this.PermissionModel.find({ apiPath });
    const isExistMethod = await this.PermissionModel.find({ method });
    if (isExistApiPath.length > 0 && isExistMethod.length > 0) {
      await this.PermissionModel.updateOne(
        { _id: id },
        {
          module,
          name,
          updatedBy: {
            _id: user._id,
            email: user.email,
          },
        },
      );
      throw new BadRequestException(
        `duong link ${apiPath} voi method la ${method} da ton tai va chi thay doi name va modul nhap vao`,
      );
    }
    return await this.PermissionModel.updateOne(
      { _id: id },
      {
        apiPath,
        method,
        module,
        name,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    await this.PermissionModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.PermissionModel.softDelete({ _id: id });
  }
}
