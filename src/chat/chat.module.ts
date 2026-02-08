import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { UploadController } from './upload.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ChatController, UploadController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
