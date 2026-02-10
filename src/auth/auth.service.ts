import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';


@Injectable()
export class AuthService {
    private msg91AuthKey: string;
    private msg91SenderId: string;

    constructor(
        private prisma: PrismaService,
        private redisService: RedisService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {
        this.msg91AuthKey = this.configService.get<string>('MSG91_AUTH_KEY') || '';
        this.msg91SenderId = this.configService.get<string>('MSG91_SENDER_ID') || 'MSGIND';
    }


    async sendOtp(phone: string) {
        // 1️⃣ Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 2️⃣ Store OTP for 5 minutes
        await this.redisService.set(`otp:${phone}`, otp, 300);

        // 🔥 ALWAYS log OTP to console for development
        console.log(`\n🔐 OTP for ${phone}: ${otp}\n`);

        // 3️⃣ Send OTP via MSG91 SMS
        try {
            // Remove '+' and spaces from phone number for MSG91
            const cleanPhone = phone.replace(/[\s+]/g, '');

            const response = await axios.post(
                'https://control.msg91.com/api/v5/flow/',
                {
                    template_id: '6988bcb9ef44340aef5c2fbc', // MSG91 OTP template ID
                    short_url: '0',
                    recipients: [
                        {
                            mobiles: cleanPhone,
                            VAR1: otp, // OTP variable in template
                        },
                    ],
                },
                {
                    headers: {
                        'authkey': this.msg91AuthKey,
                        'content-type': 'application/json',
                    },
                }
            );

            console.log(`✅ SMS sent successfully via MSG91`);
            console.log(`MSG91 Response:`, response.data);
        } catch (error) {
            console.error('⚠️ SMS failed (DLT not configured) - Use console OTP above');
        }

        return { message: 'OTP sent successfully' };
    }

    async verifyOtp(phone: string, otp: string) {
        // 1️⃣ Get stored OTP
        const storedOtp = await this.redisService.get(`otp:${phone}`);

        if (!storedOtp) {
            throw new Error('OTP expired');
        }

        if (storedOtp !== otp) {
            throw new Error('Invalid OTP');
        }

        // 2️⃣ Remove OTP after success
        await this.redisService.del(`otp:${phone}`);

        // 3️⃣ Find or create user
        let user = await this.prisma.user.findUnique({
            where: { phone },
        });

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    phone,
                    authProvider: 'PHONE',
                },
            });
        }

        // Use shared method to generate response
        return this.generateAuthResponse(user);
    }

    /**
     * Handle Google OAuth login with account linking
     */
    async googleLogin(googleProfile: {
        googleId: string;
        email: string;
        name: string;
        avatar?: string;
    }) {
        // 1. Check if user exists with this googleId
        let user = await this.prisma.user.findUnique({
            where: { googleId: googleProfile.googleId },
        });

        if (user) {
            // User found by googleId - regular OAuth login
            return this.generateAuthResponse(user);
        }

        // 2. Check if user exists with this email (account linking scenario)
        if (googleProfile.email) {
            user = await this.prisma.user.findUnique({
                where: { email: googleProfile.email },
            });

            if (user) {
                // Email exists - link accounts
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        googleId: googleProfile.googleId,
                        authProvider: 'BOTH', // Now has both phone and Google
                        // Update name and avatar only if they're empty
                        name: user.name || googleProfile.name,
                        avatar: user.avatar || googleProfile.avatar,
                        email: user.email || googleProfile.email,
                    },
                });

                return this.generateAuthResponse(user);
            }
        }

        // 3. New user - create with Google OAuth
        user = await this.prisma.user.create({
            data: {
                googleId: googleProfile.googleId,
                email: googleProfile.email,
                name: googleProfile.name,
                avatar: googleProfile.avatar,
                authProvider: 'GOOGLE',
            },
        });

        return this.generateAuthResponse(user);
    }

    /**
     * Generate JWT token and auth response
     * Works with both phone and Google auth
     */
    private generateAuthResponse(user: any) {
        const accessToken = this.jwtService.sign({
            sub: user.id,
            phone: user.phone,
            email: user.email,
            authProvider: user.authProvider,
        });

        return {
            user,
            accessToken,
        };
    }


}
