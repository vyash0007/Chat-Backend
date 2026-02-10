import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { CallService } from '../call/call.service';
import { CallRecordStatus } from '@prisma/client';

console.log('🔥 ChatGateway file loaded');

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private callService: CallService,
  ) { }

  private activeCalls = new Map<string, string>(); // chatId -> callRecordId

  async handleConnection(socket: Socket) {
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

      // Update user status to ONLINE
      await this.chatService.updateUserStatus(payload.sub, 'ONLINE');

      // Get all currently online users
      const onlineUsers = await this.chatService.getOnlineUsers();

      // Send initial online users list to the newly connected user
      socket.emit('onlineUsers', onlineUsers);

      // Broadcast user online status to all other users
      this.server.emit('userStatusChange', {
        userId: payload.sub,
        status: 'ONLINE',
      });

      console.log('🔐 Socket authenticated:', payload.sub);
    } catch (err) {
      console.log('❌ Socket auth failed:', err.message);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.user?.userId;
    if (userId) {
      // Update user status to OFFLINE
      await this.chatService.updateUserStatus(userId, 'OFFLINE');

      // Broadcast user offline status
      this.server.emit('userStatusChange', {
        userId,
        status: 'OFFLINE',
      });

      console.log('🔌 User disconnected:', userId);
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

  @SubscribeMessage('screenShareStarted')
  handleScreenShareStarted(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data.user?.userId;
    if (!userId) return;
    // Notify all other participants in the call
    socket.to(`call:${data.chatId}`).emit('screenShareStarted', { userId });
  }

  @SubscribeMessage('screenShareStopped')
  handleScreenShareStopped(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data.user?.userId;
    if (!userId) return;
    // Notify all other participants in the call
    socket.to(`call:${data.chatId}`).emit('screenShareStopped', { userId });
  }

  // ========== NEW EVENT HANDLERS ==========

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('⌨️ User typing:', user.userId, 'in chat:', data.chatId);

    // Broadcast to everyone in chat except sender
    socket.to(data.chatId).emit('userTyping', {
      chatId: data.chatId,
      userId: user.userId,
      userName: user.name || 'User',
    });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('🛑 User stopped typing:', user.userId, 'in chat:', data.chatId);

    // Broadcast to everyone in chat except sender
    socket.to(data.chatId).emit('userStoppedTyping', {
      chatId: data.chatId,
      userId: user.userId,
    });
  }

  @SubscribeMessage('updateStatus')
  async handleUpdateStatus(
    @MessageBody() data: { status: 'ONLINE' | 'AWAY' | 'DO_NOT_DISTURB' | 'OFFLINE' },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('🟢 User status change:', user.userId, 'to', data.status);

    // Update in database
    await this.chatService.updateUserStatus(user.userId, data.status);

    // Broadcast status change
    this.server.emit('userStatusChange', {
      userId: user.userId,
      status: data.status,
    });
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { chatId: string; messageId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('👁 Mark as read:', data.messageId, 'by', user.userId);

    // Create read receipt
    const receipt = await this.chatService.markMessageAsRead(
      data.messageId,
      user.userId,
    );

    // Notify the sender
    this.server.to(data.chatId).emit('messageRead', {
      messageId: data.messageId,
      userId: user.userId,
      readAt: receipt.readAt,
    });
  }

  // ========== CALL INITIATION EVENTS ==========

  @SubscribeMessage('initiateCall')
  async handleInitiateCall(
    @MessageBody() data: { chatId: string; isVideoCall: boolean },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('📞 Call initiated by:', user.userId, 'in chat:', data.chatId, 'video:', data.isVideoCall);

    // Get caller info from database
    const callerInfo = await this.chatService.getUserById(user.userId);

    // Broadcast incoming call to all sockets that have joined this chat
    // We need to find all sockets in the chat room except the caller
    // Create a call record in the database
    // We assume it's missed until accepted
    // For 1-on-1, targetId is the other participant
    const chat = await this.chatService.getChatById(data.chatId);

    if (chat) {
      const targetId = chat.isGroup ? undefined : chat.users.find(u => u.id !== user.userId)?.id;
      const record = await this.callService.createCallRecord({
        chatId: data.chatId,
        callerId: user.userId,
        targetId: targetId,
        isVideo: data.isVideoCall,
        status: 'MISSED',
      });
      this.activeCalls.set(data.chatId, record.id);
    }

    const room = this.server.sockets.adapter.rooms.get(data.chatId);
    if (room) {
      for (const sid of room) {
        const s = this.server.sockets.sockets.get(sid);
        if (s && s.data.user?.userId !== user.userId) {
          s.emit('incomingCall', {
            chatId: data.chatId,
            callerId: user.userId,
            callerName: callerInfo?.name || 'Unknown',
            callerAvatar: callerInfo?.avatar || null,
            isVideoCall: data.isVideoCall,
          });
        }
      }
    }

    // Also emit to users who might not have joined the chat room yet
    // by broadcasting to sockets that belong to chat participants
    const chatParticipants = await this.chatService.getChatParticipants(data.chatId);
    for (const participantId of chatParticipants) {
      if (participantId !== user.userId) {
        // Find socket by user ID
        for (const [, s] of this.server.sockets.sockets) {
          if (s.data.user?.userId === participantId) {
            s.emit('incomingCall', {
              chatId: data.chatId,
              callerId: user.userId,
              callerName: callerInfo?.name || 'Unknown',
              callerAvatar: callerInfo?.avatar || null,
              isVideoCall: data.isVideoCall,
            });
          }
        }
      }
    }
  }

  @SubscribeMessage('acceptCall')
  async handleAcceptCall(
    @MessageBody() data: { chatId: string; callerId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('✅ Call accepted by:', user.userId, 'from:', data.callerId);

    // Update call record status to COMPLETED
    const callRecordId = this.activeCalls.get(data.chatId);
    if (callRecordId) {
      await this.callService.updateCallStatus(callRecordId, 'COMPLETED');
    }

    // Find caller's socket and notify them
    for (const [, s] of this.server.sockets.sockets) {
      if (s.data.user?.userId === data.callerId) {
        s.emit('callAccepted', {
          chatId: data.chatId,
          acceptedBy: user.userId,
        });
      }
    }
  }

  @SubscribeMessage('rejectCall')
  async handleRejectCall(
    @MessageBody() data: { chatId: string; callerId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('❌ Call rejected by:', user.userId, 'from:', data.callerId);

    // Update call record status to REJECTED
    const callRecordId = this.activeCalls.get(data.chatId);
    if (callRecordId) {
      await this.callService.updateCallStatus(callRecordId, 'REJECTED');
      this.activeCalls.delete(data.chatId);
    }

    // Find caller's socket and notify them
    for (const [, s] of this.server.sockets.sockets) {
      if (s.data.user?.userId === data.callerId) {
        s.emit('callRejected', {
          chatId: data.chatId,
          rejectedBy: user.userId,
        });
      }
    }
  }

  @SubscribeMessage('cancelCall')
  async handleCancelCall(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const user = socket.data.user;
    if (!user) return;

    console.log('🚫 Call cancelled by:', user.userId, 'in chat:', data.chatId);

    // Update call record status to CANCELLED
    const callRecordId = this.activeCalls.get(data.chatId);
    if (callRecordId) {
      await this.callService.updateCallStatus(callRecordId, 'CANCELLED');
      this.activeCalls.delete(data.chatId);
    }

    // Notify all participants that the call was cancelled
    const chatParticipants = await this.chatService.getChatParticipants(data.chatId);
    for (const participantId of chatParticipants) {
      if (participantId !== user.userId) {
        for (const [, s] of this.server.sockets.sockets) {
          if (s.data.user?.userId === participantId) {
            s.emit('callCancelled', {
              chatId: data.chatId,
              cancelledBy: user.userId,
            });
          }
        }
      }
    }
  }
}
