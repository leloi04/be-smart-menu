import { Module } from '@nestjs/common';
import { PreOrderService } from './pre-order.service';
import { PreOrderController } from './pre-order.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { PreOrder, PreOrderSchema } from './schemas/pre-order.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { PreOrderGateway } from './pre-order.gateway';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PreOrder.name, schema: PreOrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PreOrderController],
  providers: [PreOrderService, PreOrderGateway, RedisService],
  exports: [PreOrderService],
})
export class PreOrderModule {}
