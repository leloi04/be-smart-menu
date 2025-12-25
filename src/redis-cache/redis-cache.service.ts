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
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);
  private isConnecting = false;

  onModuleInit() {
    // ✅ Ngăn không cho khởi tạo Redis nhiều lần
    if (this.client || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    /**
     * 👉 Production / Render: BẮT BUỘC dùng REDIS_URL
     * 👉 Local: mới cho phép fallback host + port
     */
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy: (times) => Math.min(times * 100, 2000),
      });

      this.logger.log(`Using REDIS_URL`);
    } else {
      // ⚠️ Chỉ dùng fallback khi chạy local
      const nodeEnv = process.env.NODE_ENV;

      if (nodeEnv && nodeEnv !== 'development') {
        throw new Error('❌ REDIS_URL is required in production');
      }

      const host = process.env.REDIS_HOST || '127.0.0.1';
      const port = Number(process.env.REDIS_PORT) || 6379;
      const password = process.env.REDIS_PASSWORD;

      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
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
      this.client = null;
      this.logger.log('🔌 Redis disconnected');
    }
  }

  /* ================== METHODS ================== */

  async set(key: string, value: any, ttlSeconds?: number) {
    if (!this.client) return;

    const data = JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.set(key, data, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, data);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.client) return null;

    const data = await this.client.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async del(key: string) {
    if (!this.client) return;
    await this.client.del(key);
  }

  async keys(pattern = '*') {
    if (!this.client) return [];
    return this.client.keys(pattern);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    return (await this.client.exists(key)) === 1;
  }
}
