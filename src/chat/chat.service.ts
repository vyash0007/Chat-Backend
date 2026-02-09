import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
    constructor(private prisma: PrismaService) { }

    async createChat(userId: string, otherUserId: string) {
        // Prevent chat with self
        if (userId === otherUserId) {
            throw new BadRequestException('Cannot create chat with yourself');
        }

        // Check if a chat already exists between these two users
        const existingChat = await this.prisma.chat.findFirst({
            where: {
                AND: [
                    { isGroup: false },
                    {
                        users: {
                            some: { id: userId },
                        },
                    },
                    {
                        users: {
                            some: { id: otherUserId },
                        },
                    },
                ],
            },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        status: true,
                        lastSeen: true,
                    },
                },
            },
        });

        // If chat exists, return it instead of creating a new one
        if (existingChat) {
            return existingChat;
        }

        // Create new chat if none exists
        return this.prisma.chat.create({
            data: {
                users: {
                    connect: [{ id: userId }, { id: otherUserId }],
                },
            },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        status: true,
                        lastSeen: true,
                    },
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
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
    }

    async getMessages(chatId: string) {
        return this.prisma.message.findMany({
            where: { chatId },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
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
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        status: true,
                        lastSeen: true,
                    },
                },
            },
        });
    }

    // ========== NEW METHODS ==========

    async updateUserStatus(
        userId: string,
        status: 'ONLINE' | 'AWAY' | 'DO_NOT_DISTURB' | 'OFFLINE',
    ) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                status,
                lastSeen: status === 'OFFLINE' ? new Date() : null,
            },
        });
    }

    async markMessageAsRead(messageId: string, userId: string) {
        // Check if receipt already exists
        const existingReceipt = await this.prisma.messageReceipt.findUnique({
            where: {
                messageId_userId: {
                    messageId,
                    userId,
                },
            },
        });

        if (existingReceipt) {
            return existingReceipt;
        }

        // Create new receipt
        return this.prisma.messageReceipt.create({
            data: {
                messageId,
                userId,
            },
        });
    }

    async addReaction(messageId: string, userId: string, emoji: string) {
        // Check if reaction already exists
        const existingReaction = await this.prisma.reaction.findUnique({
            where: {
                messageId_userId_emoji: {
                    messageId,
                    userId,
                    emoji,
                },
            },
        });

        if (existingReaction) {
            return existingReaction;
        }

        return this.prisma.reaction.create({
            data: {
                messageId,
                userId,
                emoji,
            },
        });
    }

    async removeReaction(messageId: string, userId: string, emoji: string) {
        return this.prisma.reaction.deleteMany({
            where: {
                messageId,
                userId,
                emoji,
            },
        });
    }

    async getUserChats(userId: string) {
        return this.prisma.chat.findMany({
            where: {
                isArchived: false,
                users: {
                    some: {
                        id: userId,
                    },
                },
            },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        status: true,
                        lastSeen: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
    }

    async getOnlineUsers() {
        return this.prisma.user.findMany({
            where: {
                status: {
                    in: ['ONLINE', 'AWAY', 'DO_NOT_DISTURB'],
                },
            },
            select: {
                id: true,
                status: true,
                lastSeen: true,
            },
        });
    }

    // ========== CALL HELPER METHODS ==========

    async getUserById(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                avatar: true,
            },
        });
    }

    async archiveChat(chatId: string) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
        });

        if (!chat) {
            throw new NotFoundException(`Chat with id ${chatId} not found`);
        }

        return this.prisma.chat.update({
            where: { id: chatId },
            data: {
                isArchived: !chat.isArchived,
            },
        });
    }

    async getArchivedChats(userId: string) {
        return this.prisma.chat.findMany({
            where: {
                isArchived: true,
                users: {
                    some: {
                        id: userId,
                    },
                },
            },
            include: {
                users: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        status: true,
                        lastSeen: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
    }

    async getChatParticipants(chatId: string): Promise<string[]> {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: {
                users: {
                    select: { id: true },
                },
            },
        });

        if (!chat) return [];
        return chat.users.map(user => user.id);
    }

}
