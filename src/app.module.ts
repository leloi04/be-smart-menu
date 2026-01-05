import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { softDeletePlugin } from 'soft-delete-plugin-mongoose';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { FilesModule } from './files/files.module';
import { MenuModule } from './menu/menu.module';
import { TableModule } from './table/table.module';
import { OrderModule } from './order/order.module';
import { RedisCacheModule } from './redis-cache/redis-cache.module';
import { PaymentsModule } from './payments/payments.module';
import { ReservationsModule } from './reservations/reservations.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BullQueueModule } from './bull-queue/bull-queue.module';
import { PreOrderModule } from './pre-order/pre-order.module';
import { PromotionModule } from './promotion/promotion.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL'),
        connectionFactory: (connection) => {
          connection.plugin(softDeletePlugin);
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    FilesModule,
    RolesModule,
    PermissionsModule,
    MenuModule,
    TableModule,
    OrderModule,
    RedisCacheModule,
    PaymentsModule,
    ReservationsModule,
    BullQueueModule,
    PreOrderModule,
    PromotionModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
