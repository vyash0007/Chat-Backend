import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body('phone') phone: string) {
    return this.authService.sendOtp(phone);
  }

  @Post('verify-otp')
verifyOtp(
  @Body('phone') phone: string,
  @Body('otp') otp: string,
) {
  return this.authService.verifyOtp(phone, otp);
}

}
