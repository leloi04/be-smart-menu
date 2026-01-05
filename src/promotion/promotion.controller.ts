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
import { PromotionService } from './promotion.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Public, ResponseMessage, User } from 'src/decorator/customize';
import { IUser } from 'src/types/global.constanst';

@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @ResponseMessage('Create a new Promotion')
  @Post()
  create(@Body() createPromotionDto: CreatePromotionDto, @User() user: IUser) {
    return this.promotionService.create(createPromotionDto, user);
  }

  @ResponseMessage('Fetch Promotion with paginate')
  @Get()
  findAll(
    @Query('current') currentPage: string,
    @Query('pageSize') limit: string,
    @Query() qs: string,
  ) {
    return this.promotionService.findAll(+currentPage, +limit, qs);
  }

  @ResponseMessage('Fetch Promotion by id')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promotionService.findOne(id);
  }

  @ResponseMessage('Update a Promotion')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
    @User() user: IUser,
  ) {
    return this.promotionService.update(id, updatePromotionDto, user);
  }

  @ResponseMessage('Delete a Promotion')
  @Delete(':id')
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.promotionService.remove(id, user);
  }

  @ResponseMessage('Reorder promotions')
  @Patch('reorder/bulk')
  reorder(@Body('ids') ids: string[]) {
    return this.promotionService.reorder(ids);
  }

  @Public()
  @ResponseMessage('Fetch active promotions (public)')
  @Post('/active')
  getActivePromotions() {
    return this.promotionService.getActivePromotions();
  }
}
