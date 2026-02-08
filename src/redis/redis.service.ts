import Redis from 'ioredis';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisService {
  private client = new Redis();

  getClient() {
    return this.client;
  }
}
