import { Module } from '@nestjs/common';
import { CallController } from './call.controller';
import { TurnService } from './turn.service';

@Module({
  controllers: [CallController],
  providers: [TurnService],
})
export class CallModule {}
