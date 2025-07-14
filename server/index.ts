import { type Express, type Request, type Response, type NextFunction } from "express";
import express from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity } from "./middleware/security";
import { storage } from "./storage";
import { createSuperuserIfNotExists } from "./superuser";
import { initRedis, closeRedis } from "./config/redis";
import { testDatabaseConnection, closeDatabaseConnection } from "./config/database";
import { closeQueues, setupWebhookProcessors } from "./config/queue";

// Ensure SESSION_SECRET is set
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'fallback-secret-key-for-development-only';
}

const app = express();

// Настройка безопасности
setupSecurity(app);

// Базовые middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ..._args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await closeQueues();
  await closeRedis();
  await closeDatabaseConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await closeQueues();
  await closeRedis();
  await closeDatabaseConnection();
  process.exit(0);
});

(async () => {
  try {
    // Инициализация Redis
    await initRedis();
    
    // Проверка подключения к БД
    await testDatabaseConnection();
    
    // Создание суперпользователя
    await createSuperuserIfNotExists();
    
    // Настройка обработчиков Bull Queue
    setupWebhookProcessors(storage);
    
    // Настройка аутентификации
    await setupAuth(app);
    
    // Регистрация маршрутов
    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Проверяем, не были ли уже отправлены заголовки
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
      
      // Логируем ошибку, но не бросаем её дальше
      console.error('Error handled:', err);
    });

    // Настройка Vite или статики
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Получаем порт из окружения или используем 5000 по умолчанию
    const port = Number(process.env.PORT) || 5000;
    server.listen(port, "127.0.0.1", () => {
      log(`serving on port ${port}`);
    });
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
})();