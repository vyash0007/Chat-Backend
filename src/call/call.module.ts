import { Module } from '@nestjs/common';
import { CallController } from './call.controller';
import { TurnService } from './turn.service';
import { CallService } from './call.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CallController],
  providers: [TurnService, CallService],
  exports: [CallService],
})
export class CallModule { }
