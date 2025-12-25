// src/redis-cache/redis-cache.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT) || 6379;
    const password = process.env.REDIS_PASSWORD;

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      retryStrategy(times) {
        return Math.min(times * 100, 2000);
      },
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected:', host + ':' + port);
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    const data = JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async keys(pattern = '*') {
    return this.client.keys(pattern);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
}
