import { Router, Request, Response } from 'express';
import { config } from '../config';
import logger from '../utils/logger';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  logger.debug('Health check endpoint accessed');
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: '1.0.0',
    services: {
      claude_code: 'operational',
      database: 'not_applicable',
      cache: 'not_applicable'
    },
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100
    }
  };

  res.json(health);
});

router.get('/ready', (_req: Request, res: Response): void => {
  logger.debug('Readiness check endpoint accessed');
  
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

router.get('/live', (_req: Request, res: Response): void => {
  logger.debug('Liveness check endpoint accessed');
  
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

export default router;