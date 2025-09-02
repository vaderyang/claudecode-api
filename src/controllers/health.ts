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
import { config } from '../config';
import logger from '../utils/logger';
import { authManager } from '../services';
import { query } from '@anthropic-ai/claude-code';
import * as fs from 'fs';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns the health status of the API and its dependencies
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "healthy"
 *               timestamp: "2025-01-02T12:00:00.000Z"
 *               uptime: 3600
 *               version: "1.0.0"
 *       503:
 *         description: Service is degraded or unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: ["degraded", "unhealthy"]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 version:
 *                   type: string
 *                 services:
 *                   type: object
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  logger.debug('Health check endpoint accessed');
  
  // Test Claude Code SDK availability
  let claudeCodeStatus = 'operational';
  let sdkTestResult = null;
  
  try {
    // Quick SDK test with timeout - make it optional for health check
    const testPromise = testClaudeCodeSDK();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SDK test timeout')), 3000)
    );
    
    sdkTestResult = await Promise.race([testPromise, timeoutPromise]) as { success: boolean; duration?: number; error?: string };
    claudeCodeStatus = sdkTestResult.success ? 'operational' : 'degraded';
  } catch (error) {
    claudeCodeStatus = 'unavailable';
    sdkTestResult = { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
  
  const publicDirExists = fs.existsSync(process.cwd() + '/public');
  const publicDirWritable = checkDirectoryWritable(process.cwd() + '/public');
  
  const health = {
    status: publicDirWritable ? 'healthy' : 'degraded', // Don't fail health check on SDK timeout
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: '1.0.0',
    services: {
      claude_code: claudeCodeStatus,
      database: 'not_applicable',
      cache: 'not_applicable'
    },
    authentication: authManager.getAuthStatus(),
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      publicDir: {
        exists: publicDirExists,
        writable: publicDirWritable
      }
    },
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100
    },
    diagnostics: {
      sdk_test: sdkTestResult
    }
  };
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
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

router.get('/auth', (_req: Request, res: Response): void => {
  logger.debug('Authentication status endpoint accessed');
  
  const authStatus = authManager.getAuthStatus();
  
  res.json({
    status: authStatus.isAuthenticated ? 'authenticated' : 'unauthenticated',
    timestamp: new Date().toISOString(),
    authentication: authStatus
  });
});

router.post('/auth/refresh', async (_req: Request, res: Response): Promise<void> => {
  logger.info('Manual authentication refresh requested');
  
  try {
    const refreshResult = await authManager.refreshAuthentication();
    
    res.json({
      status: refreshResult.success ? 'refreshed' : 'failed',
      timestamp: new Date().toISOString(),
      result: refreshResult,
      authentication: authManager.getAuthStatus()
    });
  } catch (error) {
    logger.error('Error during manual authentication refresh', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      authentication: authManager.getAuthStatus()
    });
  }
});

/**
 * Test Claude Code SDK availability with a minimal query
 */
async function testClaudeCodeSDK(): Promise<{ success: boolean; duration?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Use the same configuration as the service
    const options = {
      cwd: process.cwd() + '/public',
      executable: 'node' as const,
      executableArgs: [] as string[]
    };
    
    let messageReceived = false;
    
    for await (const message of query({
      prompt: 'health check',
      options
    })) {
      messageReceived = true;
      
      if (message.type === 'result') {
        const duration = Date.now() - startTime;
        
        if (message.subtype === 'success') {
          return { success: true, duration };
        } else {
          return { 
            success: false, 
            duration,
            error: `Claude Code execution failed: ${message.subtype}` 
          };
        }
      }
      
      // Safety timeout
      if (Date.now() - startTime > 2500) {
        return { success: false, error: 'Test timeout', duration: Date.now() - startTime };
      }
    }
    
    if (!messageReceived) {
      return { success: false, error: 'No messages received from SDK' };
    }
    
    return { success: false, error: 'Unexpected SDK behavior' };
  } catch (error) {
    const duration = Date.now() - startTime;
    return { 
      success: false, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown SDK error' 
    };
  }
}

/**
 * Check if directory is writable
 */
function checkDirectoryWritable(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      return false;
    }
    
    // Try to write and delete a test file
    const testFile = `${dirPath}/.write_test_${Date.now()}.tmp`;
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export default router;
