import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis-cache/redis-cache.service';

@Injectable()
export class OtpService {
  constructor(private readonly redis: RedisService) {}

  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async save(type: 'email' | 'phone', value: string, otp: string) {
    const otpKey = this.getOtpKey(type, value);
    const resendKey = this.getResendKey(type, value);

    const canSend = await this.redis.get(resendKey);
    if (canSend) {
      throw new BadRequestException('Vui lòng đợi 60s trước khi gửi lại OTP');
    }

    await this.redis.set(otpKey, otp, 300);

    await this.redis.set(resendKey, true, 60);
  }

  async get(type: 'email' | 'phone', value: string): Promise<string | null> {
    return this.redis.get<string>(this.getOtpKey(type, value));
  }

  async verify(
    type: 'email' | 'phone',
    value: string,
    otp: string,
  ): Promise<boolean> {
    const savedOtp = await this.get(type, value);
    if (!savedOtp) return false;

    return savedOtp === otp;
  }

  async remove(type: 'email' | 'phone', value: string) {
    await this.redis.del(this.getOtpKey(type, value));
  }

  private getOtpKey(type: string, value: string): string {
    return `otp:${type}:${value}`;
  }

  private getResendKey(type: string, value: string): string {
    return `otp:resend:${type}:${value}`;
  }
}
