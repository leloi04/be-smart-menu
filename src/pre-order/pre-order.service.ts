import { Injectable } from '@nestjs/common';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { UpdatePreOrderDto } from './dto/update-pre-order.dto';
import { InjectModel } from '@nestjs/mongoose';
import { PreOrder, PreOrderDocument } from './schemas/pre-order.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/types/global.constanst';
import aqp from 'api-query-params';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { PreOrderGateway } from './pre-order.gateway';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@Injectable()
export class PreOrderService {
  constructor(
    @InjectModel(PreOrder.name)
    private PreOrderModel: SoftDeleteModel<PreOrderDocument>,
    @InjectModel(User.name)
    private UserModel: SoftDeleteModel<UserDocument>,
    private readonly preOrderGateway: PreOrderGateway,
    private readonly redis: RedisService,
  ) {}

  async create(createPreOrderDto: CreatePreOrderDto, user: IUser) {
    const {
      customerId,
      payment,
      method,
      deliveryAddress,
      note,
      pickupTime,
      orderItems,
      totalItemPrice,
      totalPayment,
    } = createPreOrderDto;
    const dataUser = await this.UserModel.findById(customerId).select([
      'name',
      '_id',
    ]);
    const newPreOrder = await this.PreOrderModel.create({
      tracking: 'pending',
      ...createPreOrderDto,
      createdBy: {
        _id: user._id,
        email: user.email,
      },
    });
    const data = {
      dataUser,
      orderItems,
      deliveryAddress: deliveryAddress ?? deliveryAddress,
      pickupTime: pickupTime ?? pickupTime,
      note,
      method,
      id: newPreOrder?._id,
      totalItemPrice,
      totalPayment,
    };

    await this.preOrderGateway.handleSendPreOrder(data);
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, projection, population } = aqp(qs);
    delete filter.current;
    delete filter.pageSize;
    let offset = (currentPage - 1) * +limit;
    let defaultLimit = limit ? limit : 10;
    const totalItems = (await this.PreOrderModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.PreOrderModel.find(filter)
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
    return await this.PreOrderModel.findById(id);
  }

  async update(id: string, updatePreOrderDto: UpdatePreOrderDto, user: IUser) {
    return this.PreOrderModel.updateOne(
      { _id: id },
      {
        ...updatePreOrderDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    await this.PreOrderModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.PreOrderModel.softDelete({ _id: id });
  }
}
