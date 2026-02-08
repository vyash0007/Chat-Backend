import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import * as twilio from 'twilio';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class AuthService {
    private twilioClient: twilio.Twilio;
    private twilioPhoneNumber: string;

    constructor(
        private prisma: PrismaService,
        private redisService: RedisService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {
        const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
        const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
        this.twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

        this.twilioClient = twilio.default(accountSid, authToken);
    }


    async sendOtp(phone: string) {
        // 1️⃣ Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2️⃣ Store OTP in Redis for 5 minutes
        const redis = this.redisService.getClient();
        await redis.set(`otp:${phone}`, otp, 'EX', 300);

        // 3️⃣ Send OTP via Twilio SMS
        try {
            await this.twilioClient.messages.create({
                body: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
                from: this.twilioPhoneNumber,
                to: phone,
            });

            console.log(`OTP sent to ${phone}: ${otp}`);
        } catch (error) {
            console.error('Failed to send OTP via Twilio:', error);
            // Log OTP to console as fallback for development
            console.log(`[FALLBACK] OTP for ${phone}:`, otp);
        }

        return { message: 'OTP sent successfully' };
    }

    async verifyOtp(phone: string, otp: string) {
        const redis = this.redisService.getClient();

        // 1️⃣ Get OTP from Redis
        const storedOtp = await redis.get(`otp:${phone}`);

        if (!storedOtp) {
            throw new Error('OTP expired');
        }

        if (storedOtp !== otp) {
            throw new Error('Invalid OTP');
        }

        // 2️⃣ Remove OTP after success
        await redis.del(`otp:${phone}`);

        // 3️⃣ Find or create user
        let user = await this.prisma.user.findUnique({
            where: { phone },
        });

        if (!user) {
            user = await this.prisma.user.create({
                data: { phone },
            });
        }

        // 🔐 Create JWT token
        const accessToken = this.jwtService.sign({
            sub: user.id,
            phone: user.phone,
        });

        // ✅ Return user + token
        return {
            user,
            accessToken,
        };

    }


}
