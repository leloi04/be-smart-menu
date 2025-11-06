// redis-cache.module.ts
import { Module } from '@nestjs/common';
import { RedisService } from './redis-cache.service';
import { CacheController } from './redis-cache.controller';

@Module({
  providers: [RedisService],
  controllers: [CacheController],
  exports: [RedisService],
})
export class RedisCacheModule {}
