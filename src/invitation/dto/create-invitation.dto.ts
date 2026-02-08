import { IsEmail, IsEnum, IsUUID } from 'class-validator';

export class CreateInvitationDto {
  @IsUUID()
  chatId: string;

  @IsEmail()
  invitedEmail: string;

  @IsEnum(['PERMANENT_MEMBER', 'TEMPORARY_CALL'])
  type: 'PERMANENT_MEMBER' | 'TEMPORARY_CALL';
}
