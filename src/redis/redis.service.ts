import { Injectable, Logger } from '@nestjs/common';

/**
 * OTP storage service using an in-memory Map with TTL.
 * Replaces Redis for OTP storage — works without any external dependencies.
 */
@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private store = new Map<string, { value: string; expiresAt: number }>();

  /** Store a key-value pair with an expiry time in seconds */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    this.logger.debug(`Set key "${key}" with TTL ${ttlSeconds}s`);
  }

  /** Get a value by key (returns null if expired or not found) */
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  /** Delete a key */
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}
