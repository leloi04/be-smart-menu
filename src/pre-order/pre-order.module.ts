import { Module, forwardRef } from '@nestjs/common';
import { PreOrderService } from './pre-order.service';
import { PreOrderController } from './pre-order.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { PreOrder, PreOrderSchema } from './schemas/pre-order.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { PreOrderGateway } from './pre-order.gateway';
import { RedisCacheModule } from 'src/redis-cache/redis-cache.module';
import { OrderModule } from 'src/order/order.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PreOrder.name, schema: PreOrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => OrderModule),
    RedisCacheModule,
  ],
  controllers: [PreOrderController],
  providers: [PreOrderService, PreOrderGateway],
  exports: [PreOrderService, PreOrderGateway],
})
export class PreOrderModule {}
