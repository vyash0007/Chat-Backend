import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';

console.log('🔥 ChatGateway file loaded');

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.log('❌ No token provided');
        socket.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);

      socket.data.user = {
        userId: payload.sub,
        phone: payload.phone,
      };

      console.log('🔐 Socket authenticated:', payload.sub);
    } catch (err) {
      console.log('❌ Socket auth failed:', err.message);
      socket.disconnect();
    }
  }

  @SubscribeMessage('joinChat')
  handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { chatId } = data;

    console.log('📥 joinChat event received');
    console.log('👉 chatId:', chatId);
    console.log('👉 socketId:', socket.id);
    console.log('👉 userId:', socket.data.user?.userId);

    socket.join(chatId);

    console.log(`✅ Socket ${socket.id} joined chat ${chatId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: {
      chatId: string;
      content: string;
      type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'LOCATION';
    },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;

    if (!user) {
      console.log('❌ Unauthorized socket message attempt');
      return;
    }

    console.log('📥 sendMessage received:', data);
    console.log('👤 From user:', user.userId);

    const message = await this.chatService.sendMessage(
      data.chatId,
      user.userId, // 🔒 Secure source from JWT
      data.content,
      data.type,
    );

    console.log('📤 Emitting newMessage:', message);

    this.server.to(data.chatId).emit('newMessage', message);

    return message;
  }

  @SubscribeMessage('joinCall')
  handleJoinCall(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data.user?.userId;
    if (!userId) return;

    // Get existing users in the call room before this user joins
    const room = this.server.sockets.adapter.rooms.get(
      `call:${data.chatId}`,
    );
    const existingSocketIds = room ? Array.from(room) : [];

    // Collect user IDs of existing participants
    const existingUsers: { socketId: string; userId: string }[] = [];
    for (const sid of existingSocketIds) {
      const s = this.server.sockets.sockets.get(sid);
      if (s && s.data.user?.userId !== userId) {
        existingUsers.push({ socketId: sid, userId: s.data.user.userId });
      }
    }

    socket.join(`call:${data.chatId}`);

    // Tell the new user about existing participants
    socket.emit('existingParticipants', existingUsers.map((u) => u.userId));

    // Tell existing participants about the new user
    for (const u of existingUsers) {
      this.server.to(u.socketId).emit('userJoinedCall', userId);
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() data: { chatId: string; targetUserId: string; offer: any },
    @ConnectedSocket() socket: Socket,
  ) {
    const fromUserId = socket.data.user?.userId;
    // Send offer to the specific target user in the call room
    const room = this.server.sockets.adapter.rooms.get(
      `call:${data.chatId}`,
    );
    if (!room) return;
    for (const sid of room) {
      const s = this.server.sockets.sockets.get(sid);
      if (s && s.data.user?.userId === data.targetUserId) {
        s.emit('offer', { fromUserId, offer: data.offer });
      }
    }
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: { chatId: string; targetUserId: string; answer: any },
    @ConnectedSocket() socket: Socket,
  ) {
    const fromUserId = socket.data.user?.userId;
    const room = this.server.sockets.adapter.rooms.get(
      `call:${data.chatId}`,
    );
    if (!room) return;
    for (const sid of room) {
      const s = this.server.sockets.sockets.get(sid);
      if (s && s.data.user?.userId === data.targetUserId) {
        s.emit('answer', { fromUserId, answer: data.answer });
      }
    }
  }

  @SubscribeMessage('iceCandidate')
  handleIceCandidate(
    @MessageBody()
    data: { chatId: string; targetUserId: string; candidate: any },
    @ConnectedSocket() socket: Socket,
  ) {
    const fromUserId = socket.data.user?.userId;
    const room = this.server.sockets.adapter.rooms.get(
      `call:${data.chatId}`,
    );
    if (!room) return;
    for (const sid of room) {
      const s = this.server.sockets.sockets.get(sid);
      if (s && s.data.user?.userId === data.targetUserId) {
        s.emit('iceCandidate', { fromUserId, candidate: data.candidate });
      }
    }
  }

  @SubscribeMessage('leaveCall')
  handleLeaveCall(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data.user?.userId;
    socket.leave(`call:${data.chatId}`);
    // Notify remaining participants
    this.server.to(`call:${data.chatId}`).emit('userLeftCall', userId);
  }
}
