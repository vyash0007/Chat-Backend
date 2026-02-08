import { Controller, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Get, Param } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
    constructor(private chatService: ChatService) { }

    @Post()
    createChat(
        @Req() req,
        @Body('otherUserId') otherUserId: string,
    ) {
        if (!otherUserId) {
            throw new BadRequestException('otherUserId is required');
        }
        return this.chatService.createChat(req.user.userId, otherUserId);
    }

    @Post(':chatId/messages')
    sendMessage(
        @Req() req,
        @Param('chatId') chatId: string,
        @Body('content') content: string,
        @Body('type') type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'LOCATION',
    ) {
        return this.chatService.sendMessage(
            chatId,
            req.user.userId,
            content,
            type || 'TEXT',
        );
    }

    @Get(':chatId/messages')
    getMessages(@Param('chatId') chatId: string) {
        return this.chatService.getMessages(chatId);
    }

    @Post('group')
    createGroup(@Body() body: { userIds: string[]; name: string }) {
        return this.chatService.createGroupChat(body.userIds, body.name);
    }
}
