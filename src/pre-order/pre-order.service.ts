import { Injectable } from '@nestjs/common';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import { UpdatePreOrderDto } from './dto/update-pre-order.dto';

@Injectable()
export class PreOrderService {
  create(createPreOrderDto: CreatePreOrderDto) {
    return 'This action adds a new preOrder';
  }

  findAll() {
    return `This action returns all preOrder`;
  }

  findOne(id: number) {
    return `This action returns a #${id} preOrder`;
  }

  update(id: number, updatePreOrderDto: UpdatePreOrderDto) {
    return `This action updates a #${id} preOrder`;
  }

  remove(id: number) {
    return `This action removes a #${id} preOrder`;
  }
}
