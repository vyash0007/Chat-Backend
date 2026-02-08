import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private redisService: RedisService,
        private jwtService: JwtService,
    ) { }


    async sendOtp(phone: string) {
        // 1️⃣ Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2️⃣ Store OTP in Redis for 5 minutes
        const redis = this.redisService.getClient();
        await redis.set(`otp:${phone}`, otp, 'EX', 300);

        // 3️⃣ Log OTP (DEV ONLY)
        console.log(`OTP for ${phone}:`, otp);

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
