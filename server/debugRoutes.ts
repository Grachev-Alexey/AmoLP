import type { Express } from "express";

export function setupDebugRoutes(app: Express) {
  // Debug routes for development
  app.get('/debug/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  app.get('/debug/session', (req: any, res) => {
    res.json({
      sessionId: req.session?.id || null,
      userId: req.session?.userId || null,
      authenticated: !!req.session?.userId
    });
  });
}