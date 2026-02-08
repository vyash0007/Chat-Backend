import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

interface InvitationEmailData {
  recipientEmail: string;
  recipientName: string | null;
  inviterName: string | null;
  chatName: string | null;
  invitationType: 'PERMANENT_MEMBER' | 'TEMPORARY_CALL';
  invitationLink: string;
  expiresAt: Date;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get('EMAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASSWORD'),
      },
    });
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<void> {
    const {
      recipientEmail,
      recipientName,
      inviterName,
      chatName,
      invitationType,
      invitationLink,
      expiresAt,
    } = data;

    const invitationTypeText =
      invitationType === 'PERMANENT_MEMBER'
        ? 'to join the group chat'
        : 'for temporary access to an ongoing call';

    const subject =
      invitationType === 'PERMANENT_MEMBER'
        ? `${inviterName || 'Someone'} invited you to join ${chatName || 'a group chat'}`
        : `${inviterName || 'Someone'} invited you to join a call`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Chat Invitation</h1>
            </div>
            <div class="content">
              <p>Hi ${recipientName || 'there'},</p>
              <p><strong>${inviterName || 'Someone'}</strong> has invited you ${invitationTypeText}${chatName ? ` <strong>${chatName}</strong>` : ''}.</p>
              <p style="text-align: center;">
                <a href="${invitationLink}" class="button">Accept Invitation</a>
              </p>
              <p style="font-size: 14px; color: #6b7280;">
                This invitation will expire on ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}.
              </p>
              <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Chat App. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM', 'noreply@chatapp.com'),
      to: recipientEmail,
      subject,
      html: htmlContent,
    });
  }
}
