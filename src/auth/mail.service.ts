import { Injectable, InternalServerErrorException } from '@nestjs/common';
import sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }

  async sendOtp(email: string, otp: string) {
    try {
      await sgMail.send({
        to: email,
        from: 'kiku2004bn@gmail.com',
        subject: 'Your OTP Code',
        html: `
          <h2>OTP Verification</h2>
          <p>Your OTP code is:</p>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        `,
      });
    } catch (err) {
      console.error('SendGrid error:', err);
      throw new InternalServerErrorException('Không thể gửi email OTP');
    }
  }
}
