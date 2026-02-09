import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { TurnService } from './turn.service';
import { CallService } from './call.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('call')
export class CallController {
  constructor(
    private turnService: TurnService,
    private callService: CallService,
  ) { }

  @Get('ice')
  async getIceServers() {
    return this.turnService.getIceServers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getCallHistory(@Request() req: any) {
    return this.callService.getCallHistory(req.user.userId);
  }
}
