import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async createInvitation(inviterId: string, dto: CreateInvitationDto) {
    const { chatId, invitedEmail, type } = dto;

    // 1. Validate: Chat exists and is a group chat
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        users: true,
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    if (!chat.isGroup) {
      throw new BadRequestException(
        'Invitations are only allowed for group chats',
      );
    }

    // 2. Validate: Inviter is a member of the chat
    const isInviterMember = chat.users.some((user) => user.id === inviterId);
    if (!isInviterMember) {
      throw new ForbiddenException('Only chat members can send invitations');
    }

    // 3. Validate: User with email exists in the system
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: invitedEmail },
    });

    if (!invitedUser) {
      throw new NotFoundException(
        `No registered user found with email ${invitedEmail}`,
      );
    }

    // 4. Validate: User is not already a member (for PERMANENT_MEMBER)
    if (type === 'PERMANENT_MEMBER') {
      const isAlreadyMember = chat.users.some(
        (user) => user.id === invitedUser.id,
      );
      if (isAlreadyMember) {
        throw new BadRequestException(
          'User is already a member of this chat',
        );
      }
    }

    // 5. Check for existing pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        chatId,
        invitedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      throw new BadRequestException(
        'An active invitation already exists for this user',
      );
    }

    // 6. Create invitation with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const token = crypto.randomBytes(32).toString('hex');

    const invitation = await this.prisma.invitation.create({
      data: {
        token,
        chatId,
        invitedEmail,
        invitedUserId: invitedUser.id,
        inviterId,
        type,
        expiresAt,
      },
      include: {
        chat: true,
        inviter: true,
        invitedUser: true,
      },
    });

    // 7. Send invitation email
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const invitationLink = `${frontendUrl}/invitation/accept?token=${token}`;

    await this.emailService.sendInvitationEmail({
      recipientEmail: invitedEmail,
      recipientName: invitedUser.name,
      inviterName: invitation.inviter.name,
      chatName: chat.name,
      invitationType: type,
      invitationLink,
      expiresAt,
    });

    return {
      id: invitation.id,
      token: invitation.token,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      chat: {
        id: chat.id,
        name: chat.name,
      },
      invitedUser: {
        id: invitedUser.id,
        email: invitedUser.email,
        name: invitedUser.name,
      },
    };
  }

  async acceptInvitation(userId: string, token: string) {
    // 1. Find invitation
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        chat: {
          include: {
            users: true,
          },
        },
        invitedUser: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // 2. Validate: User accepting matches invited user
    if (invitation.invitedUserId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    // 3. Validate: Invitation status
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `Invitation is ${invitation.status.toLowerCase()}`,
      );
    }

    // 4. Validate: Not expired
    if (new Date() > invitation.expiresAt) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    // 5. Handle based on type
    if (invitation.type === 'PERMANENT_MEMBER') {
      // Add user to chat
      const isAlreadyMember = invitation.chat.users.some(
        (user) => user.id === userId,
      );
      if (!isAlreadyMember) {
        await this.prisma.chat.update({
          where: { id: invitation.chatId },
          data: {
            users: {
              connect: { id: userId },
            },
          },
        });
      }
    }
    // For TEMPORARY_CALL, no membership added - they'll join via call link

    // 6. Mark invitation as accepted
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    return {
      chatId: invitation.chatId,
      type: invitation.type,
      chat: {
        id: invitation.chat.id,
        name: invitation.chat.name,
        isGroup: invitation.chat.isGroup,
      },
    };
  }

  async getPendingInvitations(userId: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: {
        invitedUserId: userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        chat: {
          select: {
            id: true,
            name: true,
            avatar: true,
            isGroup: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  async getChatInvitations(chatId: string, userId: string) {
    // Verify user is a member of the chat
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { users: true },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const isMember = chat.users.some((user) => user.id === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this chat');
    }

    const invitations = await this.prisma.invitation.findMany({
      where: { chatId },
      include: {
        invitedUser: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
          },
        },
        inviter: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  async revokeInvitation(invitationId: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        chat: {
          include: { users: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Only inviter or chat members can revoke
    const isChatMember = invitation.chat.users.some(
      (user) => user.id === userId,
    );
    if (invitation.inviterId !== userId && !isChatMember) {
      throw new ForbiddenException('You cannot revoke this invitation');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    return { message: 'Invitation revoked successfully' };
  }
}
