import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateUserDto {
  name?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  statusMessage?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateUser(userId: string, data: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        lastSeen: true,
        bio: true,
        statusMessage: true,
        createdAt: true,
      },
    });
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        lastSeen: true,
        bio: true,
        statusMessage: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async searchUsersByPhone(phone: string) {
    return this.prisma.user.findMany({
      where: {
        phone: {
          contains: phone,
        },
      },
      select: {
        id: true,
        phone: true,
        name: true,
        avatar: true,
        status: true,
        bio: true,
      },
      take: 10,
    });
  }

  async searchUsersByEmail(email: string) {
    return this.prisma.user.findMany({
      where: {
        email: {
          contains: email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        bio: true,
      },
      take: 10,
    });
  }
}
