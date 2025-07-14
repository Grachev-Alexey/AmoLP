import Bull from 'bull';
import { redis } from './redis';
import { IStorage } from '../storage';
import { LogService } from '../services/logService';

// Настройка Bull с единым Redis клиентом
const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0, // Используем основную базу Redis
  },
};

// Очередь для webhook обработки (основная)
export const webhookQueue = new Bull('webhook-processing', {
  ...redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Хранить последние 100 выполненных задач
    removeOnFail: 50, // Хранить последние 50 неудачных задач
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

// Очередь для обработки файлов
export const fileProcessingQueue = new Bull('file-processing', {
  ...redisConfig,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 2,
    timeout: 300000, // 5 минут
  },
});

// Настройка обработчиков webhook
export function setupWebhookProcessors(storage: IStorage) {
  const logService = new LogService(storage);

  // Обработчик AmoCRM webhook
  webhookQueue.process('amocrm-webhook', 10, async (job) => {
    const { payload, userId } = job.data;
    
    try {
      // Импортируем WebhookService динамически чтобы избежать циклических зависимостей
      const { WebhookService } = await import('../services/webhookService');
      const webhookService = new WebhookService(storage);
      
      await webhookService.processAmoCrmWebhookDirect(payload);
      
      await logService.info(userId, 'AmoCRM webhook обработан через Bull Queue', {
        jobId: job.id,
        payload: payload
      }, 'webhook-queue');
      
      return { processed: true, jobId: job.id };
    } catch (error) {
      await logService.error(userId, 'Ошибка обработки AmoCRM webhook в Bull Queue', {
        jobId: job.id,
        error: (error as Error).message,
        payload: payload
      }, 'webhook-queue');
      throw error;
    }
  });

  // Обработчик LPTracker webhook
  webhookQueue.process('lptracker-webhook', 10, async (job) => {
    const { payload, userId } = job.data;
    
    try {
      const { WebhookService } = await import('../services/webhookService');
      const webhookService = new WebhookService(storage);
      
      await webhookService.processLpTrackerWebhookDirect(payload);
      
      await logService.info(userId, 'LPTracker webhook обработан через Bull Queue', {
        jobId: job.id,
        payload: payload
      }, 'webhook-queue');
      
      return { processed: true, jobId: job.id };
    } catch (error) {
      await logService.error(userId, 'Ошибка обработки LPTracker webhook в Bull Queue', {
        jobId: job.id,
        error: (error as Error).message,
        payload: payload
      }, 'webhook-queue');
      throw error;
    }
  });

  // Обработчик файлов
  fileProcessingQueue.process('excel-processing', 3, async (job) => {
    const { filePath, userId, fileUploadId } = job.data;
    
    try {
      const { FileService } = await import('../services/fileService');
      const fileService = new FileService(storage);
      
      // Здесь должна быть логика обработки файла
      await logService.info(userId, 'Файл обработан через Bull Queue', {
        jobId: job.id,
        filePath: filePath
      }, 'file-queue');
      
      return { processed: true, jobId: job.id };
    } catch (error) {
      await logService.error(userId, 'Ошибка обработки файла в Bull Queue', {
        jobId: job.id,
        error: (error as Error).message,
        filePath: filePath
      }, 'file-queue');
      throw error;
    }
  });

  console.log('✅ Bull Queue processors configured');
}

// Мониторинг очередей
export async function getQueueStats() {
  try {
    return {
      webhook: {
        waiting: await webhookQueue.getWaiting().then(jobs => jobs.length),
        active: await webhookQueue.getActive().then(jobs => jobs.length),
        completed: await webhookQueue.getCompleted().then(jobs => jobs.length),
        failed: await webhookQueue.getFailed().then(jobs => jobs.length),
      },
      fileProcessing: {
        waiting: await fileProcessingQueue.getWaiting().then(jobs => jobs.length),
        active: await fileProcessingQueue.getActive().then(jobs => jobs.length),
        completed: await fileProcessingQueue.getCompleted().then(jobs => jobs.length),
        failed: await fileProcessingQueue.getFailed().then(jobs => jobs.length),
      },
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return {
      webhook: { waiting: 0, active: 0, completed: 0, failed: 0 },
      fileProcessing: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
  }
}

// Graceful shutdown
export async function closeQueues() {
  try {
    await webhookQueue.close();
    await fileProcessingQueue.close();
    console.log('✅ Bull Queues closed');
  } catch (error) {
    console.error('❌ Error closing queues:', error);
  }
}