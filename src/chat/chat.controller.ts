import { Controller, Post, Body, Req, UseGuards, BadRequestException, Delete } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Get, Param } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
    constructor(private chatService: ChatService) { }

    // Get all chats for the authenticated user
    @Get()
    getUserChats(@Req() req) {
        return this.chatService.getUserChats(req.user.userId);
    }

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

    @Post('group')
    createGroup(@Body() body: { userIds: string[]; name: string }) {
        return this.chatService.createGroupChat(body.userIds, body.name);
    }

    @Get(':chatId/messages')
    getMessages(@Param('chatId') chatId: string) {
        return this.chatService.getMessages(chatId);
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

    // ========== NEW ENDPOINTS ==========

    @Post('messages/:messageId/reactions')
    addReaction(
        @Req() req,
        @Param('messageId') messageId: string,
        @Body('emoji') emoji: string,
    ) {
        if (!emoji) {
            throw new BadRequestException('emoji is required');
        }
        return this.chatService.addReaction(messageId, req.user.userId, emoji);
    }

    @Delete('messages/:messageId/reactions/:emoji')
    removeReaction(
        @Req() req,
        @Param('messageId') messageId: string,
        @Param('emoji') emoji: string,
    ) {
        return this.chatService.removeReaction(messageId, req.user.userId, emoji);
    }
}
