import { MongooseModule } from '@nestjs/mongoose';
import { forwardRef, Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { Table, TableSchema } from 'src/table/schemas/table.schema';
import { OrderGateway } from './order.gateway';
import { TableModule } from 'src/table/table.module';
import { RedisCacheModule } from 'src/redis-cache/redis-cache.module';
import { PreOrderModule } from 'src/pre-order/pre-order.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
      { name: Table.name, schema: TableSchema },
    ]),
    forwardRef(() => TableModule),
    forwardRef(() => PreOrderModule),
    RedisCacheModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderGateway],
  exports: [OrderService, OrderGateway],
})
export class OrderModule {}
