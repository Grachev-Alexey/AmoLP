import { IStorage } from '../storage';
import { LogService } from './logService';
import { cache } from '../config/redis';

/**
 * Оптимизации производительности с Redis кешированием
 */
export class PerformanceOptimizer {
  private storage: IStorage;
  private logService: LogService;
  
  // Connection pooling для внешних API
  private connectionPools = new Map<string, any>();
  
  // TTL для различных типов данных
  private readonly METADATA_CACHE_TTL = 30 * 60; // 30 минут
  private readonly RULES_CACHE_TTL = 5 * 60; // 5 минут
  private readonly SETTINGS_CACHE_TTL = 10 * 60; // 10 минут

  constructor(storage: IStorage) {
    this.storage = storage;
    this.logService = new LogService(storage);
  }

  /**
   * Получение правил синхронизации с Redis кешированием
   */
  async getCachedSyncRules(userId: string): Promise<any[]> {
    const cacheKey = `sync_rules:${userId}`;
    
    // Пытаемся получить из Redis
    const cached = await cache.get<any[]>(cacheKey);
    if (cached) {
      await this.logService.info(userId, 'Правила синхронизации получены из Redis кеша', { 
        rulesCount: cached.length 
      }, 'cache');
      return cached;
    }
    
    // Если нет в кеше, получаем из БД
    const rules = await this.storage.getSyncRules(userId);
    
    // Кешируем в Redis
    await cache.set(cacheKey, rules, this.RULES_CACHE_TTL);
    
    await this.logService.info(userId, 'Правила синхронизации сохранены в Redis кеш', { 
      rulesCount: rules.length 
    }, 'cache');
    
    return rules;
  }

  /**
   * Получение метаданных с Redis кешированием
   */
  async getCachedMetadata(userId: string, type: 'amocrm' | 'lptracker', metadataType: string): Promise<any> {
    const cacheKey = `metadata:${type}:${userId}:${metadataType}`;
    
    // Пытаемся получить из Redis
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      await this.logService.info(userId, `Метаданные ${type}:${metadataType} получены из Redis кеша`, {}, 'cache');
      return cached;
    }
    
    // Если нет в кеше, получаем из БД
    let metadata;
    if (type === 'amocrm') {
      metadata = await this.storage.getAmoCrmMetadata(userId, metadataType);
    } else {
      metadata = await this.storage.getLpTrackerMetadata(userId, metadataType);
    }
    
    if (metadata) {
      // Кешируем в Redis
      await cache.set(cacheKey, metadata.data, this.METADATA_CACHE_TTL);
      await this.logService.info(userId, `Метаданные ${type}:${metadataType} сохранены в Redis кеш`, {}, 'cache');
      return metadata.data;
    }
    
    return null;
  }

  /**
   * Получение настроек с кешированием
   */
  async getCachedSettings(userId: string, type: 'amocrm' | 'lptracker'): Promise<any> {
    const cacheKey = `settings:${type}:${userId}`;
    
    // Пытаемся получить из Redis
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      await this.logService.info(userId, `Настройки ${type} получены из Redis кеша`, {}, 'cache');
      return cached;
    }
    
    // Если нет в кеше, получаем из БД
    let settings;
    if (type === 'amocrm') {
      settings = await this.storage.getAmoCrmSettings(userId);
    } else {
      settings = await this.storage.getLpTrackerSettings(userId);
    }
    
    if (settings) {
      // Кешируем в Redis
      await cache.set(cacheKey, settings, this.SETTINGS_CACHE_TTL);
      await this.logService.info(userId, `Настройки ${type} сохранены в Redis кеш`, {}, 'cache');
      return settings;
    }
    
    return null;
  }

  /**
   * Батчинг операций БД для минимизации round-trips
   */
  async batchDatabaseOperations<T>(operations: (() => Promise<T>)[]): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      // Выполняем все операции параллельно
      const results = await Promise.allSettled(operations.map(op => op()));
      
      const successfulResults: T[] = [];
      const errors: any[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          errors.push({ index, error: result.reason });
        }
      });
      
      if (errors.length > 0) {
        await this.logService.warning(undefined, 'Некоторые операции БД завершились с ошибками', {
          errors,
          successCount: successfulResults.length,
          totalCount: operations.length
        }, 'performance');
      }
      
      const duration = Date.now() - startTime;
      if (duration > 1000) { // Логируем медленные операции
        await this.logService.warning(undefined, 'Медленная batch операция БД', {
          duration,
          operationsCount: operations.length,
          successCount: successfulResults.length
        }, 'performance');
      }
      
      return successfulResults;
    } catch (error) {
      await this.logService.error(undefined, 'Ошибка в batch операции БД', {
        error,
        operationsCount: operations.length
      }, 'performance');
      throw error;
    }
  }

  /**
   * Мониторинг производительности
   */
  async getPerformanceMetrics(): Promise<any> {
    const { getQueueStats } = await import('../config/queue');
    const queueStats = await getQueueStats();
    
    return {
      queue: queueStats.webhook,
      performance: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cacheStats: {
          metadata: { size: await this.getCacheSize('metadata:*') },
          rules: { size: await this.getCacheSize('sync_rules:*') }
        }
      },
      timestamp: Date.now()
    };
  }

  /**
   * Получение размера кеша по паттерну
   */
  private async getCacheSize(pattern: string): Promise<number> {
    try {
      const keys = await cache.keys(pattern);
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Получение базовых метрик системы
   */
  async getSystemMetrics(): Promise<{
    memory: NodeJS.MemoryUsage;
    redis: {
      connected: boolean;
      usedMemory?: string;
    };
    uptime: number;
  }> {
    return {
      memory: process.memoryUsage(),
      redis: {
        connected: true, // TODO: проверить статус Redis
        usedMemory: 'N/A' // TODO: получить из Redis INFO
      },
      uptime: process.uptime()
    };
  }

  /**
   * Очистка всех кешей в Redis
   */
  async clearAllCaches(): Promise<void> {
    await cache.flushPattern('sync_rules:*');
    await cache.flushPattern('metadata:*');
    await cache.flushPattern('settings:*');
    await cache.flushPattern('webhook:*'); // Очищаем кеш дедупликации webhook
    this.connectionPools.clear();
    
    await this.logService.info(undefined, 'Все Redis кеши очищены', {}, 'cache');
  }

  /**
   * Инвалидация кеша для конкретного пользователя
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await cache.flushPattern(`sync_rules:${userId}*`);
    await cache.flushPattern(`metadata:*:${userId}*`);
    await cache.flushPattern(`settings:*:${userId}*`);
    await cache.flushPattern(`webhook:${userId}*`);
    
    await this.logService.info(userId, 'Кеш пользователя очищен', {}, 'cache');
  }

  /**
   * Предварительная загрузка часто используемых данных
   */
  async preloadCriticalData(userId: string): Promise<void> {
    // Загружаем правила синхронизации
    await this.getCachedSyncRules(userId);
    
    // Загружаем настройки
    await this.getCachedSettings(userId, 'amocrm');
    await this.getCachedSettings(userId, 'lptracker');
    
    // Загружаем основные метаданные
    await this.getCachedMetadata(userId, 'amocrm', 'pipelines');
    await this.getCachedMetadata(userId, 'amocrm', 'statuses');
    await this.getCachedMetadata(userId, 'lptracker', 'projects');
  }

  /**
   * Получение pool соединений для внешних API
   */
  getConnectionPool(key: string): any {
    return this.connectionPools.get(key);
  }

  /**
   * Создание pool соединений для внешних API
   */
  setConnectionPool(key: string, pool: any): void {
    this.connectionPools.set(key, pool);
  }
}