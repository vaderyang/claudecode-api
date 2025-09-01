/**
 * MIT License
 * 
 * Copyright (c) 2025 Claude Code API
 * Original repository: https://github.com/vaderyang/claudecode-api
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authService, requireAuth, requireAdmin, authRateLimit, recordAuthAttempt, AuthRequest } from './auth';
import { databaseService } from './database';
import { webSocketService } from './websocket';
import logger from '../utils/logger';

const router = Router();

// Authentication endpoints
router.post('/auth/login', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        error: {
          message: 'Username and password are required',
          type: 'validation_error'
        }
      });
      return;
    }

    const user = await authService.authenticateUser(username, password);

    if (user) {
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      logger.info('WebUI user logged in', { username: user.username });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          last_login: user.last_login
        }
      });
    } else {
      recordAuthAttempt(req, false);
      res.status(401).json({
        error: {
          message: 'Invalid username or password',
          type: 'authentication_error'
        }
      });
    }
  } catch (error) {
    logger.error('Login error', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error'
      }
    });
  }
});

router.post('/auth/logout', (req: Request, res: Response): void => {
  const username = req.session?.user?.username;
  
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error', { error: err.message });
      res.status(500).json({
        error: {
          message: 'Failed to logout',
          type: 'internal_error'
        }
      });
      return;
    }

    logger.info('WebUI user logged out', { username });
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({
    user: req.user
  });
});

// API Key management endpoints
router.get('/keys', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const apiKeys = await databaseService.getApiKeys();
    
    // Don't return the actual keys in list view
    const safeKeys = apiKeys.map(key => ({
      ...key,
      key: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`
    }));

    res.json({ keys: safeKeys });
  } catch (error) {
    logger.error('Failed to fetch API keys', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to fetch API keys',
        type: 'internal_error'
      }
    });
  }
});

router.post('/keys', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, expires_at, rate_limit = 60, permissions = {} } = req.body;

    if (!name) {
      res.status(400).json({
        error: {
          message: 'API key name is required',
          type: 'validation_error'
        }
      });
      return;
    }

    // Generate a secure API key
    const key = `sk-${crypto.randomBytes(32).toString('hex')}`;

    const apiKey = await databaseService.createApiKey({
      key,
      name,
      description,
      expires_at,
      is_active: true,
      permissions: JSON.stringify(permissions),
      rate_limit
    });

    logger.info('API key created', { 
      keyId: apiKey.id,
      name: apiKey.name,
      createdBy: req.user?.username
    });

    // Notify WebSocket clients
    webSocketService.notifyApiKeyCreated({
      id: apiKey.id,
      name: apiKey.name,
      createdBy: req.user?.username
    });

    res.status(201).json({ 
      key: apiKey,
      message: 'API key created successfully'
    });
  } catch (error) {
    logger.error('Failed to create API key', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to create API key',
        type: 'internal_error'
      }
    });
  }
});

router.put('/keys/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { message: 'ID is required', type: 'validation_error' } });
      return;
    }
    const { name, description, expires_at, rate_limit, is_active, permissions } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (expires_at !== undefined) updates.expires_at = expires_at;
    if (rate_limit !== undefined) updates.rate_limit = rate_limit;
    if (is_active !== undefined) updates.is_active = is_active;
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);

    await databaseService.updateApiKey(id, updates);

    logger.info('API key updated', { 
      keyId: id,
      updates: Object.keys(updates),
      updatedBy: req.user?.username
    });

    // Notify WebSocket clients
    webSocketService.notifyApiKeyUpdated({
      id,
      updates: Object.keys(updates),
      updatedBy: req.user?.username
    });

    res.json({ message: 'API key updated successfully' });
  } catch (error) {
    logger.error('Failed to update API key', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to update API key',
        type: 'internal_error'
      }
    });
  }
});

router.delete('/keys/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { message: 'ID is required', type: 'validation_error' } });
      return;
    }
    
    await databaseService.deleteApiKey(id);

    logger.info('API key deleted', { 
      keyId: id,
      deletedBy: req.user?.username
    });

    // Notify WebSocket clients
    webSocketService.notifyApiKeyDeleted(id);

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete API key', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to delete API key',
        type: 'internal_error'
      }
    });
  }
});

// Request logs endpoints
router.get('/logs', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 100,
      startDate,
      endDate,
      apiKeyId,
      endpoint,
      statusCode
    } = req.query;

    const options: {
      page: number;
      limit: number;
      startDate?: string;
      endDate?: string;
      apiKeyId?: string;
      endpoint?: string;
      statusCode?: number;
    } = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 1000), // Max 1000 per request
    };

    if (startDate) options.startDate = startDate as string;
    if (endDate) options.endDate = endDate as string;
    if (apiKeyId) options.apiKeyId = apiKeyId as string;
    if (endpoint) options.endpoint = endpoint as string;
    if (statusCode) options.statusCode = parseInt(statusCode as string);

    const { logs, total } = await databaseService.getRequestLogs(options);

    res.json({
      logs,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch logs', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to fetch logs',
        type: 'internal_error'
      }
    });
  }
});

// Analytics endpoints
router.get('/analytics', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, metricTypes } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        error: {
          message: 'Start date and end date are required',
          type: 'validation_error'
        }
      });
      return;
    }

    const types = metricTypes ? (metricTypes as string).split(',') : undefined;
    const analytics = await databaseService.getAnalytics(
      startDate as string,
      endDate as string,
      types
    );

    res.json({ analytics });
  } catch (error) {
    logger.error('Failed to fetch analytics', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to fetch analytics',
        type: 'internal_error'
      }
    });
  }
});

// Real-time analytics for dashboard
router.get('/analytics/realtime', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0] as string;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string;

    // Get today's and yesterday's metrics for comparison
    const todayMetrics = await databaseService.getAnalytics(today, today);
    const yesterdayMetrics = await databaseService.getAnalytics(yesterday, yesterday);

    // Get recent request logs for activity
    const { logs: recentLogs } = await databaseService.getRequestLogs({
      page: 1,
      limit: 10
    });

    // Calculate basic stats
    const todayRequests = todayMetrics.find(m => m.metric_type === 'requests')?.metric_value || 0;
    const yesterdayRequests = yesterdayMetrics.find(m => m.metric_type === 'requests')?.metric_value || 0;
    
    const todayErrors = todayMetrics.find(m => m.metric_type === 'errors')?.metric_value || 0;
    const yesterdayErrors = yesterdayMetrics.find(m => m.metric_type === 'errors')?.metric_value || 0;

    res.json({
      stats: {
        todayRequests,
        yesterdayRequests,
        requestsChange: yesterdayRequests > 0 ? ((todayRequests - yesterdayRequests) / yesterdayRequests * 100) : 0,
        todayErrors,
        yesterdayErrors,
        errorsChange: yesterdayErrors > 0 ? ((todayErrors - yesterdayErrors) / yesterdayErrors * 100) : 0,
        errorRate: todayRequests > 0 ? (todayErrors / todayRequests * 100) : 0
      },
      recentActivity: recentLogs.map(log => ({
        timestamp: log.timestamp,
        endpoint: log.endpoint,
        status: log.status_code,
        responseTime: log.response_time,
        model: log.model
      }))
    });
  } catch (error) {
    logger.error('Failed to fetch realtime analytics', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to fetch realtime analytics',
        type: 'internal_error'
      }
    });
  }
});

// System configuration endpoints
router.get('/config', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { configService } = await import('../services/configService');
    const currentConfig = await configService.getConfig();
    
    const safeConfig = {
      port: currentConfig.port,
      nodeEnv: currentConfig.nodeEnv,
      requireOpenAiKey: currentConfig.requireOpenAiKey,
      logLevel: currentConfig.logLevel,
      corsOrigin: currentConfig.corsOrigin
    };

    res.json({ config: safeConfig });
  } catch (error) {
    logger.error('Failed to fetch config', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to fetch configuration',
        type: 'internal_error'
      }
    });
  }
});

router.put('/config', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requireOpenAiKey, logLevel, corsOrigin } = req.body;
    const updates: any = {};

    // Validate and prepare updates
    if (requireOpenAiKey !== undefined) {
      if (typeof requireOpenAiKey !== 'boolean') {
        res.status(400).json({
          error: {
            message: 'requireOpenAiKey must be a boolean',
            type: 'validation_error'
          }
        });
        return;
      }
      updates.requireOpenAiKey = requireOpenAiKey;
    }

    if (logLevel !== undefined) {
      const validLogLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLogLevels.includes(logLevel)) {
        res.status(400).json({
          error: {
            message: `logLevel must be one of: ${validLogLevels.join(', ')}`,
            type: 'validation_error'
          }
        });
        return;
      }
      updates.logLevel = logLevel;
    }

    if (corsOrigin !== undefined) {
      if (typeof corsOrigin !== 'string') {
        res.status(400).json({
          error: {
            message: 'corsOrigin must be a string',
            type: 'validation_error'
          }
        });
        return;
      }
      updates.corsOrigin = corsOrigin;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        error: {
          message: 'No valid configuration updates provided',
          type: 'validation_error'
        }
      });
      return;
    }

    const { configService } = await import('../services/configService');
    await configService.updateConfig(updates, req.user?.username);

    logger.info('Configuration updated successfully', { 
      updates: Object.keys(updates),
      updatedBy: req.user?.username
    });

    // Notify WebSocket clients
    webSocketService.notifyConfigUpdate({
      updates: Object.keys(updates),
      updatedBy: req.user?.username
    });

    res.json({ 
      message: 'Configuration updated successfully',
      updatedKeys: Object.keys(updates)
    });
  } catch (error) {
    logger.error('Failed to update config', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to update configuration',
        type: 'internal_error'
      }
    });
  }
});

// System health endpoint
router.get('/health', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    // Get recent logs to check system health
    const { logs: recentErrorLogs } = await databaseService.getRequestLogs({
      page: 1,
      limit: 10,
      statusCode: 500
    });

    const health = {
      status: 'healthy',
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      },
      recentErrors: recentErrorLogs.length,
      timestamp: new Date().toISOString()
    };

    res.json({ health });
  } catch (error) {
    logger.error('Failed to fetch health status', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      error: {
        message: 'Failed to fetch health status',
        type: 'internal_error'
      }
    });
  }
});

export default router;
