import { Injectable } from '@nestjs/common';
import Twilio from 'twilio';

@Injectable()
export class TurnService {
  private client = Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );

  async getIceServers() {
    const token = await this.client.tokens.create();
    return token.iceServers;
  }
}
