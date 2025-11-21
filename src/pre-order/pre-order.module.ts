import { Module } from '@nestjs/common';
import { PreOrderService } from './pre-order.service';
import { PreOrderController } from './pre-order.controller';

@Module({
  controllers: [PreOrderController],
  providers: [PreOrderService],
})
export class PreOrderModule {}
