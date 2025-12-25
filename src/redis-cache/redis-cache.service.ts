// src/redis-cache/redis-cache.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  onModuleInit() {
    /**
     * 👉 Ưu tiên REDIS_URL (Render / Production)
     * 👉 Fallback sang HOST + PORT (Local)
     */
    if (process.env.REDIS_URL) {
      this.client = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => Math.min(times * 100, 2000),
      });

      this.logger.log(`Using REDIS_URL: ${process.env.REDIS_URL}`);
    } else {
      const host = process.env.REDIS_HOST || '127.0.0.1';
      const port = Number(process.env.REDIS_PORT) || 6379;
      const password = process.env.REDIS_PASSWORD;

      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        retryStrategy: (times) => Math.min(times * 100, 2000),
      });

      this.logger.log(`Using Redis host: ${host}:${port}`);
    }

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('❌ Redis error', err.message);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
      this.logger.log('🔌 Redis disconnected');
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
    return (await this.client.exists(key)) === 1;
  }
}
