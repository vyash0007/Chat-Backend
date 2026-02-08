import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationController {
  constructor(private invitationService: InvitationService) {}

  // POST /invitations - Create new invitation
  @Post()
  createInvitation(@Req() req, @Body() dto: CreateInvitationDto) {
    return this.invitationService.createInvitation(req.user.userId, dto);
  }

  // POST /invitations/accept - Accept invitation
  @Post('accept')
  acceptInvitation(@Req() req, @Body() dto: AcceptInvitationDto) {
    return this.invitationService.acceptInvitation(req.user.userId, dto.token);
  }

  // GET /invitations/pending - Get user's pending invitations
  @Get('pending')
  getPendingInvitations(@Req() req) {
    return this.invitationService.getPendingInvitations(req.user.userId);
  }

  // GET /invitations/chat/:chatId - Get invitations for a chat
  @Get('chat/:chatId')
  getChatInvitations(@Req() req, @Param('chatId') chatId: string) {
    return this.invitationService.getChatInvitations(chatId, req.user.userId);
  }

  // DELETE /invitations/:invitationId - Revoke invitation
  @Delete(':invitationId')
  revokeInvitation(@Req() req, @Param('invitationId') invitationId: string) {
    return this.invitationService.revokeInvitation(
      invitationId,
      req.user.userId,
    );
  }
}
