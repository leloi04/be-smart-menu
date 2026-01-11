import { BadRequestException, Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private client = new Twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );

  normalizePhoneVN(phone: string): string {
    phone = phone.replace(/\s+/g, '');

    if (phone.startsWith('0')) {
      return '+84' + phone.slice(1);
    }

    if (phone.startsWith('+84')) {
      return phone;
    }

    throw new BadRequestException('Số điện thoại không hợp lệ');
  }

  async sendOtp(phone: string) {
    const phoneFormat = this.normalizePhoneVN(phone);

    return this.client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({
        to: phoneFormat,
        channel: 'sms',
      });
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const phoneFormat = this.normalizePhoneVN(phone);

    const result = await this.client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({
        to: phoneFormat,
        code,
      });

    return result.status === 'approved';
  }
}
