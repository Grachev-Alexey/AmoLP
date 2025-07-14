import { IStorage } from "../storage";
import { InsertSystemLog } from "@shared/schema";

export class LogService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async log(
    userId: string | undefined,
    level: 'info' | 'warning' | 'error',
    message: string,
    data?: any,
    source?: string
  ): Promise<void> {
    try {
      const logEntry: InsertSystemLog = {
        userId,
        level,
        message,
        data,
        source: source || 'system',
      };

      await this.storage.createSystemLog(logEntry);
      
      // Выводим в консоль только в режиме разработки
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${level.toUpperCase()}] ${message}`, data);
      }
    } catch (error) {
      // Fallback для критических ошибок логирования
      if (process.env.NODE_ENV === 'development') {
        console.error('Ошибка при записи лога:', error);
      }
    }
  }

  async info(userId: string | undefined, message: string, data?: any, source?: string): Promise<void> {
    await this.log(userId, 'info', message, data, source);
  }

  async warning(userId: string | undefined, message: string, data?: any, source?: string): Promise<void> {
    await this.log(userId, 'warning', message, data, source);
  }

  async error(userId: string | undefined, message: string, data?: any, source?: string): Promise<void> {
    await this.log(userId, 'error', message, data, source);
  }
}
