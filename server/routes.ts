import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { AmoCrmService } from "./services/amoCrmService";
import { LpTrackerService } from "./services/lpTrackerService";
import { WebhookService } from "./services/webhookService";
import { FileService } from "./services/fileService";
import { LogService } from "./services/logService";
import { insertAmoCrmSettingsSchema, insertLpTrackerSettingsSchema, insertSyncRuleSchema } from "@shared/schema";
import { ZodError } from "zod";
import multer from "multer";
import { setupDebugRoutes } from "./debugRoutes";
import { setupHealthRoutes } from "./routes/health";

const upload = multer({ dest: "uploads/" });

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

function requireSuperuser(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  // Get user and check role
  storage.getUser(req.session.userId).then(user => {
    if (!user || user.role !== "superuser") {
      return res.status(403).json({ message: "Superuser access required" });
    }
    req.user = user;
    next();
  }).catch((err: unknown) => {
    res.status(500).json({ message: "Server error" });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {

  const amoCrmService = new AmoCrmService(storage);
  const lpTrackerService = new LpTrackerService(storage);
  const webhookService = new WebhookService(storage);
  const fileService = new FileService(storage);
  const logService = new LogService(storage);

  // Setup debug routes only in development
  if (process.env.NODE_ENV === 'development') {
    setupDebugRoutes(app);
  }

  // Setup health check routes
  setupHealthRoutes(app);



  // Simple user endpoint that MUST include role
  app.get('/api/user', requireAuth, async (req: any, res) => {
    const userId = req.session.userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Manual object with forced role
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role || 'user', // FORCE ROLE WITH FALLBACK
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  });

  // AmoCRM settings routes
  app.get('/api/amocrm/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const settings = await storage.getAmoCrmSettings(userId);
      res.json(settings);
    } catch (error) {

      res.status(500).json({ message: "Не удалось получить настройки AmoCRM" });
    }
  });

  app.post('/api/amocrm/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const validatedData = insertAmoCrmSettingsSchema.parse({
        ...req.body,
        userId,
      });
      
      // Сохраняем настройки без шифрования
      const settings = await storage.saveAmoCrmSettings(validatedData);
      await logService.log(userId, 'info', 'Настройки AmoCRM сохранены', { settings }, 'settings');
      res.json(settings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Некорректные данные", errors: error.errors });
      }

      res.status(500).json({ message: "Не удалось сохранить настройки AmoCRM" });
    }
  });

  app.post('/api/amocrm/test-connection', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      // Всегда используем только сохраненные настройки из базы данных
      const settings = await storage.getAmoCrmSettings(userId);
      
      if (!settings) {
        return res.json({ isValid: false, message: "Настройки AmoCRM не найдены. Сначала сохраните настройки." });
      }
      
      const { subdomain, apiKey } = settings;
      
      if (!apiKey) {
        return res.json({ isValid: false, message: "API ключ не настроен" });
      }
      
      if (!subdomain) {
        return res.json({ isValid: false, message: "Поддомен не настроен" });
      }
      

      
      // Проверяем подключение
      const testResult = await amoCrmService.testConnection(subdomain, apiKey);
      
      // Обновляем статус подключения
      await storage.updateAmoCrmSettings(userId, { isActive: testResult });
      
      if (testResult) {
        res.json({ isValid: true });
      } else {
        res.json({ 
          isValid: false, 
          message: "API ключ недействителен или истек. Проверьте правильность данных." 
        });
      }
    } catch (error) {

      res.status(500).json({ message: "Не удалось проверить подключение к AmoCRM" });
    }
  });

  app.post('/api/amocrm/refresh-metadata', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await amoCrmService.refreshMetadata(userId);
      await logService.log(userId, 'info', 'Метаданные AmoCRM обновлены', {}, 'metadata');
      res.json({ message: "Метаданные успешно обновлены" });
    } catch (error) {

      res.status(500).json({ message: "Не удалось обновить метаданные" });
    }
  });

  app.get('/api/amocrm/metadata/:type', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { type } = req.params;
      
      const metadata = await storage.getAmoCrmMetadata(userId, type);
      res.json(metadata);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить метаданные" });
    }
  });

  // LPTracker Global Settings (for superuser only)
  app.post('/api/lptracker/global-settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superuser') {
        return res.status(403).json({ message: 'Доступ запрещен. Требуется роль суперпользователя.' });
      }

      const { login, password, service, address } = req.body;
      
      if (!login || !password) {
        return res.status(400).json({ message: 'Логин и пароль обязательны' });
      }

      const existingSettings = await storage.getLpTrackerGlobalSettings();
      
      let settings;
      if (existingSettings) {
        settings = await storage.updateLpTrackerGlobalSettings({
          login,
          password,
          service: service || 'CRM Integration',
          address: address || 'direct.lptracker.ru',
        });
      } else {
        settings = await storage.saveLpTrackerGlobalSettings({
          login,
          password,
          service: service || 'CRM Integration',
          address: address || 'direct.lptracker.ru',
        });
      }
      
      await logService.log(userId, 'info', 'Глобальные настройки LPTracker сохранены', {}, 'settings');
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: 'Не удалось сохранить глобальные настройки LPTracker' });
    }
  });

  app.get('/api/lptracker/global-settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superuser') {
        return res.status(403).json({ message: 'Доступ запрещен. Требуется роль суперпользователя.' });
      }

      const settings = await storage.getLpTrackerGlobalSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: 'Не удалось получить глобальные настройки LPTracker' });
    }
  });

  // LPTracker User Settings (project ID only)
  app.post('/api/lptracker/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { projectId } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ message: 'ID проекта обязателен' });
      }

      const settings = await storage.saveLpTrackerSettings({
        userId,
        projectId,
      });
      
      await logService.log(userId, 'info', 'Настройки проекта LPTracker сохранены', { settings }, 'settings');
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: 'Не удалось сохранить настройки LPTracker' });
    }
  });

  app.get('/api/lptracker/settings', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const settings = await storage.getLpTrackerSettings(userId);
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: 'Не удалось получить настройки LPTracker' });
    }
  });

  // LPTracker connection test
  app.post('/api/lptracker/test-connection', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'superuser') {
        return res.status(403).json({ message: 'Доступ запрещен. Требуется роль суперпользователя.' });
      }

      let { login, password, address } = req.body;
      
      // If credentials are empty, try to use saved settings
      if (!login || !password) {
        const settings = await storage.getLpTrackerGlobalSettings();
        if (settings) {
          login = settings.login;
          password = settings.password;
          address = settings.address;
        }
      }
      
      if (!login || !password) {
        return res.json({ isValid: false, message: "Логин и пароль не предоставлены" });
      }
      
      // Test connection
      const testResult = await lpTrackerService.testConnection(login, password, address);
      
      if (testResult) {
        res.json({ isValid: true });
      } else {
        res.json({ 
          isValid: false, 
          message: "Неверные учетные данные или проблема с подключением к LPTracker" 
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Не удалось проверить подключение к LPTracker" });
    }
  });

  // LPTracker metadata refresh
  app.post('/api/lptracker/refresh-metadata', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      await lpTrackerService.refreshMetadata(userId);
      await logService.log(userId, 'info', 'Метаданные LPTracker обновлены', {}, 'metadata');
      res.json({ message: "Метаданные успешно обновлены" });
    } catch (error) {

      res.status(500).json({ message: "Не удалось обновить метаданные" });
    }
  });

  // Get LPTracker metadata
  app.get('/api/lptracker/metadata/:type', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { type } = req.params;
      
      const metadata = await storage.getLpTrackerMetadata(userId, type);
      res.json(metadata);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить метаданные" });
    }
  });

  // Get LPTracker projects
  app.get('/api/lptracker/projects', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const projects = await lpTrackerService.getProjects(userId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить список проектов" });
    }
  });



  // Check if LPTracker is configured globally
  app.get('/api/lptracker/global-status', requireAuth, async (req: any, res) => {
    try {
      const globalSettings = await storage.getLpTrackerGlobalSettings();
      res.json({ configured: !!globalSettings });
    } catch (error) {
      res.status(500).json({ message: 'Не удалось проверить статус LPTracker' });
    }
  });

  // LPTracker status for regular users
  app.get("/api/lptracker/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      // Check global settings first
      const globalSettings = await storage.getLpTrackerGlobalSettings();
      const globalConfigured = globalSettings?.isActive === true;
      
      // Check user-specific settings
      const userSettings = await storage.getLpTrackerSettings(userId);
      const userConfigured = !!userSettings?.projectId;
      
      // User is "connected" if both global settings are active AND user has project
      const connected = globalConfigured && userConfigured;
      
      res.json({ 
        configured: globalConfigured,
        connected: connected,
        hasToken: !!globalSettings?.login && !!globalSettings?.password,
        projectId: userSettings?.projectId || null
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // LPTracker webhook management routes
  app.get('/api/lptracker/webhook-status', requireSuperuser, async (req: any, res) => {
    try {
      const webhookStatus = await lpTrackerService.getWebhookStatus();
      res.json(webhookStatus);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить статус вебхука" });
    }
  });



  // GET endpoints для тестирования вебхуков (для отладки)
  app.get('/api/webhooks/amocrm', async (req, res) => {
    
    await logService.log(undefined, 'info', 'AmoCRM Webhook GET запрос', { 
      headers: req.headers,
      query: req.query,
      method: req.method,
      url: req.url
    }, 'webhook');
    
    res.json({ 
      message: "AmoCRM webhook endpoint активен",
      postUrl: `${req.protocol}://${req.get('host')}/api/webhooks/amocrm`,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/webhooks/lptracker', async (req, res) => {
    
    await logService.log(undefined, 'info', 'LPTracker Webhook GET запрос', { 
      headers: req.headers,
      query: req.query,
      method: req.method,
      url: req.url
    }, 'webhook');
    
    res.json({ 
      message: "LPTracker webhook endpoint активен",
      postUrl: `${req.protocol}://${req.get('host')}/api/webhooks/lptracker`,
      timestamp: new Date().toISOString()
    });
  });

  // Available fields for field mapping
  app.get('/api/field-mapping/available-fields/:targetCrm', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { targetCrm } = req.params;
      
      if (targetCrm !== 'amocrm' && targetCrm !== 'lptracker') {
        return res.status(400).json({ message: "Неподдерживаемая CRM система" });
      }

      // Используем SmartFieldMapper для получения доступных полей
      const { SmartFieldMapper } = await import('./services/smartFieldMapper');
      const smartFieldMapper = new SmartFieldMapper(storage);
      
      const availableFields = await smartFieldMapper.getAvailableFields(userId, targetCrm);
      res.json(availableFields);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить список доступных полей" });
    }
  });

  // Sync rules routes
  app.get('/api/sync-rules', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const rules = await storage.getSyncRules(userId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить правила синхронизации" });
    }
  });

  app.post('/api/sync-rules', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      // Log the incoming data for debugging
      
      const validatedData = insertSyncRuleSchema.parse({
        ...req.body,
        userId,
      });
      
      const rule = await storage.createSyncRule(validatedData);
      await logService.log(userId, 'info', 'Создано новое правило синхронизации', { rule }, 'rules');
      res.json(rule);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Некорректные данные", 
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      res.status(500).json({ message: "Не удалось создать правило синхронизации" });
    }
  });

  app.put('/api/sync-rules/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      // Remove timestamp fields from the request body before updating
      const { createdAt, updatedAt, ...updateData } = req.body;
      
      const rule = await storage.updateSyncRule(parseInt(id), updateData);
      if (!rule) {
        return res.status(404).json({ message: "Правило не найдено" });
      }
      
      await logService.log(userId, 'info', 'Правило синхронизации обновлено', { rule }, 'rules');
      res.json(rule);
    } catch (error) {
      res.status(500).json({ message: "Не удалось обновить правило синхронизации" });
    }
  });

  app.delete('/api/sync-rules/:id', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      
      await storage.deleteSyncRule(parseInt(id));
      await logService.log(userId, 'info', 'Правило синхронизации удалено', { id }, 'rules');
      res.json({ message: "Правило успешно удалено" });
    } catch (error) {
      res.status(500).json({ message: "Не удалось удалить правило синхронизации" });
    }
  });

  // File upload routes
  app.get('/api/file-uploads', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const uploads = await storage.getFileUploads(userId);
      res.json(uploads);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить список загруженных файлов" });
    }
  });

  app.post('/api/file-uploads', requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "Файл не загружен" });
      }
      
      const fileUpload = await fileService.processFile(userId, file);
      res.json(fileUpload);
    } catch (error) {
      res.status(500).json({ message: "Не удалось загрузить файл" });
    }
  });

  // Call results routes
  app.get('/api/call-results', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const results = await storage.getCallResults(userId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить результаты прозвонов" });
    }
  });

  app.post('/api/call-results', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = await storage.createCallResult({
        ...req.body,
        userId,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Не удалось создать результат прозвона" });
    }
  });

  // Logs routes
  app.get('/api/logs', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const logs = await storage.getSystemLogs(userId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить логи" });
    }
  });

  // Webhook routes
  // Высокопроизводительные webhook endpoints с очередями
  app.post('/api/webhooks/amocrm', async (req, res) => {
    try {
      
      await logService.log(undefined, 'info', 'AmoCRM Webhook получен (добавляется в очередь)', { 
        headers: req.headers,
        body: req.body,
        url: req.url
      }, 'webhook');
      
      const jobId = await webhookService.handleAmoCrmWebhook(req.body);
      res.json({ 
        message: "Webhook принят в обработку", 
        jobId,
        status: "queued"
      });
    } catch (error) {
      await logService.log(undefined, 'error', 'Ошибка добавления AmoCRM webhook в очередь', { error, body: req.body }, 'webhook');
      res.status(500).json({ message: "Не удалось добавить webhook в очередь" });
    }
  });

  app.post('/api/webhooks/lptracker', async (req, res) => {
    try {
      
      await logService.log(undefined, 'info', 'LPTracker Webhook получен (добавляется в очередь)', { 
        headers: req.headers,
        body: req.body,
        url: req.url
      }, 'webhook');
      
      const jobId = await webhookService.handleLpTrackerWebhook(req.body);
      res.json({ 
        message: "Webhook принят в обработку", 
        jobId,
        status: "queued"
      });
    } catch (error) {
      await logService.log(undefined, 'error', 'Ошибка добавления LPTracker webhook в очередь', { error, body: req.body }, 'webhook');
      res.status(500).json({ message: "Не удалось добавить webhook в очередь" });
    }
  });

  // Мониторинг производительности очереди webhook
  app.get('/api/admin/webhook-queue-stats', requireSuperuser, async (req, res) => {
    try {
      const stats = webhookService.getQueueStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error) });
    }
  });

  // Полная статистика производительности системы
  app.get('/api/admin/performance-metrics', requireSuperuser, async (req, res) => {
    try {
      const { getQueueStats } = await import('./config/queue');
      const queueStats = await getQueueStats();
      const performanceMetrics = await webhookService.getPerformanceMetrics();
      
      res.json({
        queue: queueStats,
        performance: performanceMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Принудительная очистка кешей (админ-функция)
  app.post('/api/admin/clear-caches', requireSuperuser, async (req, res) => {
    try {
      const { cache } = await import('./config/redis');
      await cache.flushPattern('*'); // Очищаем все кеши
      res.json({ message: "Все кеши успешно очищены" });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Анализ масштабирования
  app.get('/api/admin/scaling-analysis', requireSuperuser, async (req, res) => {
    try {
      const { ScalingOptimizer } = await import('./services/scalingOptimizer');
      const scalingOptimizer = new ScalingOptimizer(storage);
      const analysis = await scalingOptimizer.analyzeBottlenecks();
      
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Расчет ресурсов для целевого количества пользователей
  app.post('/api/admin/calculate-resources', requireSuperuser, async (req, res) => {
    try {
      const { userCount } = req.body;
      if (!userCount || userCount < 1) {
        return res.status(400).json({ error: 'Необходимо указать количество пользователей' });
      }

      const { ScalingOptimizer } = await import('./services/scalingOptimizer');
      const scalingOptimizer = new ScalingOptimizer(storage);
      const requirements = scalingOptimizer.calculateResourceRequirements(userCount);
      const migrationPlan = await scalingOptimizer.generateMigrationPlan(userCount);
      
      res.json({
        requirements,
        migrationPlan,
        dockerCompose: userCount > 1000 ? 'version: "3.8"\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n  redis:\n    image: redis:7-alpine\n    ports:\n      - "6379:6379"' : null
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Admin monitoring endpoints
  app.get('/api/admin/system-health', requireSuperuser, async (req: any, res) => {
    try {
      const health = {
        database: true,
        apiServer: true,
        logging: true,
        lastCheck: new Date().toISOString()
      };
      res.json(health);
    } catch (error) {
      res.status(500).json({ message: "Не удалось проверить состояние системы" });
    }
  });

  app.get('/api/admin/recent-activity', requireSuperuser, async (req: any, res) => {
    try {
      const logs = await storage.getSystemLogs();
      const recentActivity = logs.slice(0, 50).map(log => ({
        type: log.source === 'webhook' ? 'webhook_processed' : 
              log.source === 'settings' ? 'integration_setup' :
              log.level === 'error' ? 'error' : 'user_login',
        message: log.message,
        timestamp: log.createdAt,
        userId: log.userId
      }));
      res.json(recentActivity);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить данные об активности" });
    }
  });

  app.get('/api/admin/integration-status', requireSuperuser, async (req: any, res) => {
    try {
      // Disable caching for this endpoint
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const allUsers = await db.select().from(users);
      let amoCrmActive = 0;
      let lpTrackerActive = 0;
      let webhooksProcessed = 0;
      const userIntegrations = [];

      for (const user of allUsers) {
        const amoCrmSettings = await storage.getAmoCrmSettings(user.id);
        const lpTrackerSettings = await storage.getLpTrackerSettings(user.id);
        
        if (amoCrmSettings?.isActive) amoCrmActive++;
        if (lpTrackerSettings?.projectId) lpTrackerActive++;

        // Get detailed integration status for each user
        let amoCrmStatus = 'disconnected';
        let lpTrackerStatus = 'disconnected';
        let webhookStatus = 'not_configured';

        // Check AmoCRM connection status
        if (amoCrmSettings?.subdomain && amoCrmSettings?.apiKey) {
          amoCrmStatus = amoCrmSettings.isActive ? 'configured' : 'inactive';
        }

        // Check LPTracker connection status
        if (lpTrackerSettings?.projectId) {
          const globalSettings = await storage.getLpTrackerGlobalSettings();
          if (globalSettings?.login && globalSettings?.password && globalSettings?.isActive) {
            lpTrackerStatus = 'configured';
            // Check user-specific webhook status
            webhookStatus = lpTrackerSettings?.webhookActive ? 'active' : 'not_configured';
          }
        }

        userIntegrations.push({
          userId: user.id,
          username: user.username,
          amoCrm: {
            status: amoCrmStatus,
            subdomain: amoCrmSettings?.subdomain || null,
            hasApiKey: !!amoCrmSettings?.apiKey,
            isActive: amoCrmSettings?.isActive || false
          },
          lpTracker: {
            status: lpTrackerStatus,
            projectId: lpTrackerSettings?.projectId || null,
            webhookStatus: webhookStatus
          }
        });
      }

      // Get webhook count from logs
      const logs = await storage.getSystemLogs();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      webhooksProcessed = logs.filter(log => 
        log.source === 'webhook' && 
        log.createdAt && 
        new Date(log.createdAt) >= today
      ).length;

      // Get global LPTracker webhook status
      const globalSettings = await storage.getLpTrackerGlobalSettings();
      const lpTrackerWebhook = {
        url: globalSettings?.webhookUrl || null,
        active: globalSettings?.webhookActive || false,
        configured: !!globalSettings?.webhookUrl
      };

      res.json({
        amoCrmActive,
        lpTrackerActive,
        webhooksProcessed,
        totalUsers: allUsers.length,
        userIntegrations,
        lpTrackerWebhook
      });
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить статус интеграций" });
    }
  });

  // API endpoint for webhook status monitoring
  app.get('/api/admin/webhook-status', requireSuperuser, async (req: any, res) => {
    try {
      // Disable caching for this endpoint
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const allUsers = await db.select().from(users);
      const webhooks = [];

      for (const user of allUsers) {
        const lpTrackerSettings = await storage.getLpTrackerSettings(user.id);
        
        if (lpTrackerSettings?.projectId) {
          // Get recent webhook activity from logs
          const logs = await storage.getSystemLogs();
          const userLogs = logs.filter(log => 
            log.userId === user.id && 
            log.source === 'webhook' &&
            log.createdAt && 
            new Date(log.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
          );

          const lastActivity = userLogs.length > 0 
            ? Math.max(...userLogs.map(log => new Date(log.createdAt!).getTime()))
            : null;

          webhooks.push({
            username: user.username,
            projectId: lpTrackerSettings.projectId,
            status: lpTrackerSettings.webhookActive ? 'active' : 'not_configured',
            activityCount: userLogs.length,
            lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null
          });
        }
      }

      res.json({ webhooks });
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить статус вебхуков" });
    }
  });

  // API endpoint for testing user integrations
  app.post('/api/admin/test-user-integrations', requireSuperuser, async (req: any, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "userId обязателен" });
      }

      const results = {
        amoCrm: { success: false, message: "Не настроено" },
        lpTracker: { success: false, message: "Не настроено" }
      };

      // Test AmoCRM connection
      const amoCrmSettings = await storage.getAmoCrmSettings(userId);
      if (amoCrmSettings?.subdomain && amoCrmSettings?.apiKey) {
        try {
          const testResult = await amoCrmService.testConnection(amoCrmSettings.subdomain, amoCrmSettings.apiKey);
          results.amoCrm = {
            success: testResult,
            message: testResult ? "Подключение успешно" : "Ошибка подключения"
          };
        } catch (error) {
          results.amoCrm = { success: false, message: "Ошибка тестирования" };
        }
      }

      // Test LPTracker connection
      const lpTrackerSettings = await storage.getLpTrackerSettings(userId);
      const globalSettings = await storage.getLpTrackerGlobalSettings();
      
      if (lpTrackerSettings?.projectId && globalSettings?.login && globalSettings?.password) {
        try {
          const testResult = await lpTrackerService.testConnection(globalSettings.login, globalSettings.password);
          results.lpTracker = {
            success: testResult,
            message: testResult ? "Подключение успешно" : "Ошибка подключения"
          };
        } catch (error) {
          results.lpTracker = { success: false, message: "Ошибка тестирования" };
        }
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Не удалось протестировать интеграции" });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      const [rules, uploads, callResults] = await Promise.all([
        storage.getSyncRules(userId),
        storage.getFileUploads(userId),
        storage.getCallResults(userId),
      ]);
      
      const stats = {
        activeRules: rules.filter(r => r.isActive).length,
        totalExecutions: rules.reduce((sum, r) => sum + (r.executionCount || 0), 0),
        totalUploads: uploads.length,
        totalCallResults: callResults.length,
        recentActivity: await storage.getSystemLogs(userId),
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить статистику панели управления" });
    }
  });

  // Admin routes
  app.get('/api/admin/users', requireSuperuser, async (req: any, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers.map(user => ({
        ...user,
        password: undefined // Never send passwords
      })));
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить список пользователей" });
    }
  });

  app.post('/api/admin/users', requireSuperuser, async (req: any, res) => {
    try {
      const { username, email, password, firstName, lastName, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Имя пользователя и пароль обязательны" });
      }

      const user = await storage.createUser({
        id: Math.random().toString(36).substring(2, 15),
        username,
        email,
        password,
        firstName,
        lastName,
        role: role || 'user',
      });

      res.json({
        ...user,
        password: undefined
      });
    } catch (error) {
      res.status(500).json({ message: "Не удалось создать пользователя" });
    }
  });

  app.patch('/api/admin/users/:id', requireSuperuser, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { username, email, firstName, lastName, role } = req.body;
      
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const updatedUser = await storage.upsertUser({
        id,
        username: username || existingUser.username,
        email: email || existingUser.email,
        firstName: firstName || existingUser.firstName,
        lastName: lastName || existingUser.lastName,
        role: role || existingUser.role,
        password: existingUser.password, // Keep existing password
      });

      res.json({
        ...updatedUser,
        password: undefined
      });
    } catch (error) {
      res.status(500).json({ message: "Не удалось обновить пользователя" });
    }
  });

  app.delete('/api/admin/users/:id', requireSuperuser, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if user exists and is not a superuser
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }
      
      if (existingUser.role === 'superuser') {
        return res.status(400).json({ message: "Нельзя удалить администратора" });
      }

      await db.delete(users).where(eq(users.id, id));
      res.json({ message: "Пользователь удален" });
    } catch (error) {
      res.status(500).json({ message: "Не удалось удалить пользователя" });
    }
  });

  app.get('/api/admin/stats', requireSuperuser, async (req: any, res) => {
    try {
      const allUsers = await db.select().from(users);
      const all_logs = await storage.getSystemLogs();
      
      let totalIntegrations = 0;
      let eventsProcessed = 0;
      
      // Count integrations
      for (const user of allUsers) {
        const amoCrmSettings = await storage.getAmoCrmSettings(user.id);
        const lpTrackerSettings = await storage.getLpTrackerSettings(user.id);
        
        
        
        if (amoCrmSettings?.isActive) totalIntegrations++;
        if (lpTrackerSettings?.isActive) totalIntegrations++;
      }

      // Count events processed in last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      eventsProcessed = all_logs.filter(log => 
        log.source === 'webhook' && 
        log.createdAt && 
        new Date(log.createdAt) >= yesterday
      ).length;

      // Count new users today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newUsersToday = allUsers.filter(user => 
        user.createdAt && 
        new Date(user.createdAt) >= today
      ).length;
      
      const stats = {
        totalUsers: allUsers.length,
        activeUsers: allUsers.filter(u => u.role !== 'superuser').length,
        totalIntegrations,
        eventsProcessed,
        newUsersToday,
        totalErrors: all_logs.filter(l => l.level === 'error').length,
      };
      
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить статистику" });
    }
  });

  app.get('/api/admin/logs', requireSuperuser, async (req: any, res) => {
    try {
      const logs = await storage.getSystemLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить логи" });
    }
  });

  // Admin LPTracker user settings endpoints
  app.get("/api/admin/lptracker-user-settings", requireSuperuser, async (req, res) => {
    try {
      const settings = await storage.getAllLpTrackerSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:userId/lptracker", requireSuperuser, async (req, res) => {
    try {
      const { userId } = req.params;
      const { projectId } = req.body;

      

      if (!projectId) {
        return res.status(400).json({ message: "ID проекта обязателен" });
      }

      const settings = await storage.saveLpTrackerSettings({
        userId,
        projectId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      res.json(settings);
    } catch (error: any) {
      
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/lptracker-settings', requireSuperuser, async (req: any, res) => {
    try {
      const settings = await storage.getLpTrackerGlobalSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить настройки LPTracker" });
    }
  });

  // Test LPTracker connection (admin only)
  app.post("/api/admin/lptracker/test-connection", requireSuperuser, async (req: any, res) => {
    try {
      const { login, password, service, address } = req.body;
      const result = await lpTrackerService.testConnection(login, password, address || "direct.lptracker.ru");
      
      if (result) {
        // Save the settings with the successful connection
        const settings = {
          login,
          password,
          service: service || "CRM Integration",
          address: address || "direct.lptracker.ru",
          isActive: true,
        };
        await storage.saveLpTrackerGlobalSettings(settings);
        
        res.json({ success: true, message: "Connection successful" });
      } else {
        res.json({ success: false, message: "Invalid credentials" });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: "Connection test failed" });
    }
  });

  app.post('/api/admin/lptracker-settings', requireSuperuser, async (req: any, res) => {
    try {
      const { login, password, service, address, isActive } = req.body;
      
      const settings = await storage.saveLpTrackerGlobalSettings({
        login,
        password,
        service: service || 'CRM Integration',
        address: address || 'direct.lptracker.ru',
        isActive: isActive !== false,
      });
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Не удалось сохранить настройки LPTracker" });
    }
  });

  // Setup LPTracker webhook for specific user
  app.post('/api/lptracker/webhook/user/:userId', requireSuperuser, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({ success: false, message: 'Webhook URL обязателен' });
      }

      if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID обязателен' });
      }

      const result = await lpTrackerService.setupWebhook(userId, webhookUrl);
      if (result) {
        res.json({ success: true, message: 'Webhook установлен успешно для пользователя' });
      } else {
        res.status(500).json({ success: false, message:  'Не удалось установить webhook' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Ошибка при установке webhook' });
    }
  });

  // Remove LPTracker webhook for specific user
  app.delete('/api/lptracker/webhook/user/:userId', requireSuperuser, async (req: any, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID обязателен' });
      }

      const result = await lpTrackerService.removeWebhook(userId);
      if (result) {
        res.json({ success: true, message: 'Webhook удален успеш_но для пользователя' });
      } else {
        res.status(500).json({ success: false, message: 'Не удалось удалить webhook' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Ошибка при удалении webhook' });
    }
  });

  // Get LPTracker webhook status for user
  app.get('/api/lptracker/webhook-status/:userId', requireSuperuser, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const result = await lpTrackerService.getWebhookStatus(userId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: '_ удалось получить статус webhook' });
    }
  });

  // Get global LPTracker webhook status
  app.get('/api/lptracker/webhook-status', requireSuperuser, async (req: any, res) => {
    try {
      // Disable caching for this endpoint
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const result = await lpTrackerService.getWebhookStatus();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Не удалось получить статус webhook' });
    }
  });

  // Get detailed webhook status for admin
  app.get('/api/admin/webhook-status', requireSuperuser, async (req: any, res) => {
    try {
      
      const allUsers = await db.select().from(users);
      const webhookStatuses = [];

      for (const user of allUsers) {
        const lpTrackerSettings = await storage.getLpTrackerSettings(user.id);
        
        if (lpTrackerSettings?.projectId) {
          // Check recent webhook activity for this user
          const recentLogs = await storage.getSystemLogs(user.id);
          const webhookActivity = recentLogs.filter(log => 
            log.source === 'webhook' && 
            new Date(log.createdAt!).getTime() > Date.now() - 24 * 60 * 60  * 1000
          );

          const lastWebhookActivity = webhookActivity.length > 0 ? 
            webhookActivity[0].createdAt : null;

          const webhookData = {
            userId: user.id,
            username: user.username,
            projectId: lpTrackerSettings.projectId,
            webhookActive: lpTrackerSettings.webhookActive || false,
            lastActivity: lastWebhookActivity,
            activityCount: webhookActivity.length,
            status: lpTrackerSettings.webhookActive ? 'configured' : 'not_configured'
          };
          
          webhookStatuses.push(webhookData);
        }
      }

      res.json({ webhooks: webhookStatuses });
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить статус вебхуков" });
    }
  });


  // Test specific user's integrations for admin
  app.post('/api/admin/test-user-integrations', requireSuperuser, async (req: any, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      const results = {
        userId,
        amoCrm: { status: 'not_configured', message: '' },
        lpTracker: { status: 'not_configured', message: '' }
      };

      // Test AmoCRM
      const amoCrmSettings = await storage.getAmoCrmSettings(userId);
      if (amoCrmSettings?.subdomain && amoCrmSettings?.apiKey) {
        try {
          const testResult = await amoCrmService.testConnection(amoCrmSettings.subdomain, amoCrmSettings.apiKey);
          results.amoCrm = {
            status: testResult ? 'connected' : 'error',
            message: testResult ? 'Подключение успешно' : 'Ошибка подключения'
          };
        } catch (error) {
          results.amoCrm = {
            status: 'error',
            message: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : 'Ошибка тестирования AmoCRM'
          };
        }
      }

      // Test LPTracker
      const lpTrackerSettings = await storage.getLpTrackerSettings(userId);
      if (lpTrackerSettings?.projectId) {
        try {
          const globalSettings = await storage.getLpTrackerGlobalSettings();
          if (globalSettings?.login && globalSettings?.password) {
            const testResult = await lpTrackerService.testConnection(globalSettings.login, globalSettings.password, globalSettings.address);
            results.lpTracker = {
              status: testResult ? 'connected' : 'error',
              message: testResult ? 'Подключение успешно' : 'Ошибка подключения'
            };
          } else {
            results.lpTracker = {
              status: 'error',
              message: 'Глобальные настройки LPTracker не сконфигурированы'
            };
          }
        } catch (error) {
          results.lpTracker = {
            status: 'error',
            message: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : 'Ошибка тестирования LPTracker'
          };
        }
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Не удалось протестировать интеграции пользователя" });
    }
  });

  app.get('/api/admin/system-settings', requireSuperuser, async (req: any, res) => {
    try {
      // Mock system settings - in real app these would be in database
      const settings = {
        maxFileSize: 10,
        allowRegistration: true,
        sessionTimeout: 24,
        logRetentionDays: 30,
        maintenanceMode: false,
        maintenanceMessage: "Система временно недоступна",
      };
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Не удалось получить системные настройки" });
    }
  });

  app.post('/api/admin/system-settings', requireSuperuser, async (req: any, res) => {
    try {
      // Mock save - in real app these would be saved to database
      const settings = req.body;
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Не удалось сохранить системные настройки" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
