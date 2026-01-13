import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ResponseMessage('Create a review')
  @Post()
  create(@Body() createReviewDto: CreateReviewDto, @User() user: IUser) {
    return this.reviewsService.create(createReviewDto, user);
  }

  @ResponseMessage('Fetch reviews with paginate')
  @Get()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.reviewsService.findAll(+currentPage, +limit, qs);
  }

  @ResponseMessage('Fetch review by id')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @ResponseMessage('Update a review')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @User() user: IUser,
  ) {
    return this.reviewsService.update(id, updateReviewDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.reviewsService.remove(id, user);
  }

  @ResponseMessage('get comments of item')
  @Post('comment-list')
  fetchListComment(@Body('id') id: string) {
    return this.reviewsService.fetchListComment(id);
  }
}
