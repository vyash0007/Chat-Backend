import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { CallModule } from './call/call.module';
import { UsersModule } from './users/users.module';
import { UploadController } from './chat/upload.controller';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    RedisModule,
    ChatModule,
    CallModule,
    UsersModule,
  ],
  controllers: [AppController, TestController, UploadController],
  providers: [AppService],
})
export class AppModule {}

