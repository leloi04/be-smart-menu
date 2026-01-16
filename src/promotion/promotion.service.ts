import { Injectable } from '@nestjs/common';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Promotion, PromotionDocument } from './schemas/promotion.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/types/global.constanst';
import aqp from 'api-query-params';

@Injectable()
export class PromotionService {
  constructor(
    @InjectModel(Promotion.name)
    private PromotionModel: SoftDeleteModel<PromotionDocument>,
  ) {}

  async create(createPromotionDto: CreatePromotionDto, user: IUser) {
    // AUTO INCREASE ORDER
    const lastPromotion = await this.PromotionModel.findOne({})
      .sort({ order: -1 })
      .select('order')
      .lean();

    const nextOrder = lastPromotion ? lastPromotion.order + 1 : 1;

    const res = await this.PromotionModel.create({
      ...createPromotionDto,
      order: nextOrder,
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
    const totalItems = (await this.PromotionModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.PromotionModel.find(filter)
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
    return await this.PromotionModel.findById(id);
  }

  async update(
    id: string,
    updatePromotionDto: UpdatePromotionDto,
    user: IUser,
  ) {
    return await this.PromotionModel.updateOne(
      { _id: id },
      {
        ...updatePromotionDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    await this.PromotionModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.PromotionModel.softDelete({ _id: id });
  }

  async reorder(ids: string[]) {
    const bulkOps = ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { order: index + 1 },
      },
    }));

    await this.PromotionModel.bulkWrite(bulkOps);
    return { message: 'Reorder success' };
  }

  async getActivePromotions() {
    const now = new Date();

    return this.PromotionModel.find({
      isDeleted: false,
      status: true,
      $or: [
        { displayMode: 'MANUAL' },

        {
          displayMode: 'AUTO',
          $expr: {
            $and: [
              { $lte: [{ $toDate: '$startAt' }, now] },
              { $gte: [{ $toDate: '$endAt' }, now] },
            ],
          },
        },
      ],
    })
      .sort({ order: 1 })
      .lean();
  }
}
