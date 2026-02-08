import { Controller, Get } from '@nestjs/common';
import { TurnService } from './turn.service';

@Controller('call')
export class CallController {
  constructor(private turnService: TurnService) {}

  @Get('ice')
  async getIceServers() {
    return this.turnService.getIceServers();
  }
}
