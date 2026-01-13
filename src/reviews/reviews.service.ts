import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/types/global.constanst';
import aqp from 'api-query-params';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private ReviewModel: SoftDeleteModel<ReviewDocument>,
  ) {}

  async create(createReviewDto: CreateReviewDto, user: IUser) {
    const res = await this.ReviewModel.create({
      ...createReviewDto,
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
    const totalItems = (await this.ReviewModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);
    const result = await this.ReviewModel.find(filter)
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
        current: currentPage,
        pageSize: limit,
        pages: totalPages,
        total: totalItems,
      },
      result,
    };
  }

  async findOne(id: string) {
    return (await this.ReviewModel.findById(id))?.populate({
      path: 'permissions',
      select: { _id: 1, name: 1, apiPath: 1, method: 1, module: 1 },
    });
  }

  async update(id: string, updateReviewDto: UpdateReviewDto, user: IUser) {
    return await this.ReviewModel.updateOne(
      { _id: id },
      {
        ...updateReviewDto,
        updatedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
  }

  async remove(id: string, user: IUser) {
    const res = await this.ReviewModel.findById(id);
    await this.ReviewModel.updateOne(
      { _id: id },
      {
        deletedBy: {
          _id: user._id,
          email: user.email,
        },
      },
    );
    return await this.ReviewModel.softDelete({ _id: id });
  }

  async fetchListComment(id: string) {
    const comments = await this.ReviewModel.find({ menuItemId: id }).sort(
      '-createdAt',
    );
    const result = comments.map((c) => {
      return {
        id: c._id,
        user: c.user,
        rating: c.rating,
        comment: c.comment,
        createdAt: c.createdAt,
        createdBy: c.createdBy,
      };
    });
    return result;
  }
}
