import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

export const sessionRedisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
});

export async function initRedis() {
  try {
    console.log('🔄 Подключение к Redis...');
    console.log(`Redis Host: ${process.env.REDIS_HOST || 'localhost'}`);
    console.log(`Redis Port: ${process.env.REDIS_PORT || '6379'}`);
    
    await redis.ping();
    console.log('✅ Redis connections established');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    
    console.log('🔍 Проверяем доступность Redis...');
    console.log('Убедитесь что Redis запущен на localhost:6379');
    console.log('Команды для проверки:');
    console.log('  Windows: redis-cli ping');
    console.log('  Linux/Mac: redis-cli ping');
    
    throw error;
  }
}

export async function closeRedis() {
  try {
    await Promise.all([
      redis.quit(),
      sessionRedisClient.quit()
    ]);
    console.log('✅ Redis connections closed');
  } catch (error) {
    console.error('❌ Error closing Redis connections:', error);
  }
}

export class RedisCache {
  private readonly defaultTTL = 3600;
  private client: Redis;

  constructor(client: Redis = redis) {
    this.client = client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(`crm:${key}`);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.client.setex(`crm:${key}`, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(`crm:${key}`);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(`crm:${key}`);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(`crm:${pattern}`);
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  async flushPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error('Redis flush pattern error:', error);
    }
  }

  async setWithTTL(key: string, value: any, ttl: number): Promise<void> {
    try {
      await this.client.setex(`crm:${key}`, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis setWithTTL error:', error);
    }
  }

  async setIfNotExists(key: string, value: any, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.set(`crm:${key}`, JSON.stringify(value), 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      console.error('Redis setIfNotExists error:', error);
      return false;
    }
  }
}

export const cache = new RedisCache();