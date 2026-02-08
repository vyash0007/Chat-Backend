import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { CallModule } from './call/call.module';
import { UploadController } from './chat/upload.controller';


@Module({
  imports: [PrismaModule, AuthModule, RedisModule, ChatModule, CallModule],
  controllers: [AppController, TestController, UploadController],
  providers: [AppService],
})
export class AppModule {}

