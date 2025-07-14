import { Express } from 'express';
import helmet from 'helmet';

export function setupSecurity(app: Express) {
  // Базовая безопасность
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Простой rate limiting без внешних зависимостей
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  const rateLimit = (windowMs: number, max: number) => {
    return (req: any, res: any, next: any) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
      }
      
      const record = requestCounts.get(ip)!;
      
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
        return next();
      }
      
      if (record.count >= max) {
        return res.status(429).json({ 
          message: 'Слишком много запросов, повторите позже' 
        });
      }
      
      record.count++;
      next();
    };
  };

  // Rate limiting для API
  const apiLimiter = rateLimit(15 * 60 * 1000, 100); // 15 минут, 100 запросов
  const webhookLimiter = rateLimit(1 * 60 * 1000, 60); // 1 минута, 60 запросов

  // Применяем лимиты
  app.use('/api/', apiLimiter);
  app.use('/webhook/', webhookLimiter);

  // Доверие к прокси (для production)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
}