import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return req.user;
  }
}
