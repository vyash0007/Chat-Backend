import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
    constructor(private prisma: PrismaService) { }

    async createChat(userId: string, otherUserId: string) {
        return this.prisma.chat.create({
            data: {
                users: {
                    connect: [{ id: userId }, { id: otherUserId }],
                },
            },
        });
    }

    async sendMessage(
        chatId: string,
        senderId: string,
        content: string,
        type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'LOCATION',
    ) {
        // Validate that the chat exists
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
        });

        if (!chat) {
            throw new NotFoundException(`Chat with id ${chatId} not found`);
        }

        // Validate that the sender exists
        const sender = await this.prisma.user.findUnique({
            where: { id: senderId },
        });

        if (!sender) {
            throw new NotFoundException(`User with id ${senderId} not found`);
        }

        return this.prisma.message.create({
            data: {
                chatId,
                senderId,
                content,
                type,
            },
        });
    }

    async getMessages(chatId: string) {
        return this.prisma.message.findMany({
            where: { chatId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async createGroupChat(userIds: string[], name: string) {
        return this.prisma.chat.create({
            data: {
                name,
                isGroup: true,
                users: {
                    connect: userIds.map((id) => ({ id })),
                },
            },
        });
    }

}
