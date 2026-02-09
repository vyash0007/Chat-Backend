import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CallRecordStatus } from '@prisma/client';

@Injectable()
export class CallService {
    constructor(private prisma: PrismaService) { }

    async createCallRecord(data: {
        chatId: string;
        callerId: string;
        targetId: string;
        isVideo: boolean;
        status?: CallRecordStatus;
    }) {
        return this.prisma.callRecord.create({
            data: {
                chatId: data.chatId,
                callerId: data.callerId,
                targetId: data.targetId,
                isVideo: data.isVideo,
                status: data.status || 'COMPLETED',
            },
        });
    }

    async getCallHistory(userId: string) {
        return this.prisma.callRecord.findMany({
            where: {
                OR: [{ callerId: userId }, { targetId: userId }],
            },
            include: {
                caller: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
                target: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 50,
        });
    }

    async updateCallStatus(callId: string, status: CallRecordStatus, duration?: number) {
        return this.prisma.callRecord.update({
            where: { id: callId },
            data: {
                status,
                duration: duration || 0,
            },
        });
    }
}
