import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Menu, MenuDocument } from './schemas/menu.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { MenuGateway } from './menu.gateway';
import { IUser } from 'src/types/global.constanst';
import aqp from 'api-query-params';

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(Menu.name) private MenuModel: SoftDeleteModel<MenuDocument>,
    private readonly menuGateway: MenuGateway,
  ) {}

  async create(createMenuDto: CreateMenuDto, user: IUser) {
    const newMenuItem = await this.MenuModel.create({
      ...createMenuDto,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });

    return {
      _id: newMenuItem._id,
      createdAt: newMenuItem.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;
    let offset = (currentPage - 1) * +limit;
    let defaultLimit = limit ? limit : 10;
    const totalItems = (await this.MenuModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.MenuModel.find(filter)
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
    return await this.MenuModel.findById(id);
  }

  async update(id: string, updateMenuDto: UpdateMenuDto, user: IUser) {
    return this.MenuModel.updateOne(
      { _id: id },
      {
        ...updateMenuDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    await this.MenuModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.MenuModel.softDelete({ _id: id });
  }

  async updateStatus(id: string, status: 'available' | 'out_of_stock') {
    const item = await this.MenuModel.findById(id);
    if (!item) throw new NotFoundException('Menu item not found');

    item.status = status;
    await item.save();
    return item;
  }
}
