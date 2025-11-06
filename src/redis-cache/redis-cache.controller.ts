// src/redis-cache/redis-cache.controller.ts
import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { RedisService } from './redis-cache.service';
import { Public } from 'src/decorator/customize';

@Controller('cache')
export class CacheController {
  constructor(private readonly redis: RedisService) {}

  @Public()
  @Post(':key')
  async set(@Param('key') key: string, @Body() body: any) {
    await this.redis.set(key, body, 600); // TTL = 600s
    return { message: `Đã lưu key ${key}`, data: body };
  }

  @Public()
  @Get(':key')
  async get(@Param('key') key: string) {
    const data = await this.redis.get(key);
    return data ?? { message: 'Không tìm thấy dữ liệu' };
  }

  @Public()
  @Delete(':key')
  async delete(@Param('key') key: string) {
    await this.redis.del(key);
    return { message: `Đã xoá key ${key}` };
  }

  @Public()
  @Get()
  async listKeys() {
    const keys = await this.redis.keys();
    return { keys };
  }
}
