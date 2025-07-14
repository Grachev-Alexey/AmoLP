import { Express } from 'express';
import { db } from '../db';
import { redis } from '../config/redis';
import { getQueueStats } from '../config/queue';

export function setupHealthRoutes(app: Express) {
  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
          database: false,
          redis: false,
          memory: false,
          queues: false,
        }
      };

      // Database check
      try {
        await db.execute('SELECT 1');
        health.checks.database = true;
      } catch (error) {
        health.status = 'unhealthy';
        health.checks.database = false;
      }

      // Redis check
      try {
        await redis.ping();
        health.checks.redis = true;
      } catch (error) {
        health.status = 'unhealthy';
        health.checks.redis = false;
      }

      // Memory check
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      health.checks.memory = memoryUsageMB < 1024; // Less than 1GB

      // Queue check
      try {
        const queueStats = await getQueueStats();
        health.checks.queues = queueStats.webhook.waiting < 1000; // Less than 1000 waiting jobs
      } catch (error) {
        health.checks.queues = false;
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Readiness check
  app.get('/ready', async (req, res) => {
    try {
      // Check if all critical services are ready
      await db.execute('SELECT 1');
      await redis.ping();
      
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        message: 'Service not ready',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Liveness check
  app.get('/live', (req, res) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
}