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

import { Request, Response, NextFunction } from 'express';
import { databaseService } from './database';
import logger from '../utils/logger';

// Store original request body for logging
interface ExtendedRequest extends Request {
  rawBody?: Buffer;
  originalBody?: any;
}

// Middleware to capture and log API requests
export const requestLogger = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Only log /v1/ API endpoints
  if (!req.path.startsWith('/v1/')) {
    next();
    return;
  }
  
  // Store the original request body for later logging
  req.originalBody = req.body;
  
  // Store original end function
  const originalEnd = res.end.bind(res);
  
  // Override end function to capture response
  (res as any).end = function(chunk?: any, _encoding?: any, _cb?: any) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
      // Extract API key if present
      let apiKeyId: string | undefined;
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.substring(7);
        // We'll need to look up the API key ID from the key value
        // For now, we'll store the key itself and look it up later
        Promise.resolve().then(async () => {
          try {
            const keyRecord = await databaseService.getApiKeyByKey(apiKey);
            apiKeyId = keyRecord?.id;
            
            // Log the request with full original content
            await databaseService.logRequest({
              timestamp: new Date().toISOString(),
              api_key_id: apiKeyId,
              endpoint: req.path,
              method: req.method,
              model: (req as ExtendedRequest).originalBody?.model,
              status_code: res.statusCode,
              request_body: (req as ExtendedRequest).originalBody ? JSON.stringify((req as ExtendedRequest).originalBody, null, 2) : undefined,
              response_body: chunk ? chunk.toString() : undefined,
              response_time: responseTime,
              tokens_used: extractTokensFromResponse(chunk),
              ip_address: getClientIP(req),
              user_agent: req.headers['user-agent'],
              error_message: res.statusCode >= 400 ? extractErrorMessage(chunk) : undefined
            });

            // Update API key usage count
            if (keyRecord) {
              await databaseService.updateApiKey(keyRecord.id, {
                usage_count: keyRecord.usage_count + 1,
                last_used: new Date().toISOString()
              });
            }

            // Record analytics
            await recordAnalytics(req, res, responseTime);
          } catch (error) {
            // Don't let logging errors affect the main request
            logger.error('Failed to log request to database', {
              error: error instanceof Error ? error.message : 'Unknown error',
              endpoint: req.path,
              method: req.method
            });
          }
        });
      } else {
        // Log request without API key
        Promise.resolve().then(async () => {
          try {
            await databaseService.logRequest({
              timestamp: new Date().toISOString(),
              endpoint: req.path,
              method: req.method,
              model: (req as ExtendedRequest).originalBody?.model,
              status_code: res.statusCode,
              request_body: (req as ExtendedRequest).originalBody ? JSON.stringify((req as ExtendedRequest).originalBody, null, 2) : undefined,
              response_body: chunk ? chunk.toString() : undefined,
              response_time: responseTime,
              tokens_used: extractTokensFromResponse(chunk),
              ip_address: getClientIP(req),
              user_agent: req.headers['user-agent'],
              error_message: res.statusCode >= 400 ? extractErrorMessage(chunk) : undefined
            });

            await recordAnalytics(req, res, responseTime);
          } catch (error) {
            logger.error('Failed to log request to database', {
              error: error instanceof Error ? error.message : 'Unknown error',
              endpoint: req.path,
              method: req.method
            });
          }
        });
      }
    
    // Call original end function
    return originalEnd(chunk);
  };
  
  next();
};

// Helper functions - removed shouldLogBody and truncateString as we now log all /v1/ endpoints with full content

function extractTokensFromResponse(chunk: any): number | undefined {
  if (!chunk) return undefined;
  
  try {
    const response = JSON.parse(chunk.toString());
    return response.usage?.total_tokens;
  } catch {
    return undefined;
  }
}

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIp = req.headers['x-real-ip'] as string;
  const connectionAddr = (req.connection as any)?.remoteAddress;
  const socketAddr = (req.socket as any)?.remoteAddress;
  
  const ip = forwarded || realIp || connectionAddr || socketAddr || 'unknown';
  return ip.split(',')[0].trim();
}

function extractErrorMessage(chunk: any): string | undefined {
  if (!chunk) return undefined;
  
  try {
    const response = JSON.parse(chunk.toString());
    return response.error?.message;
  } catch {
    return undefined;
  }
}

async function recordAnalytics(req: Request, res: Response, responseTime: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0] as string;
  
  try {
    // Record request count
    await databaseService.recordAnalytic({
      date: today,
      metric_type: 'requests',
      metric_value: 1,
      metadata: JSON.stringify({
        endpoint: req.path,
        method: req.method,
        model: req.body?.model
      })
    });

    // Record response time
    await databaseService.recordAnalytic({
      date: today,
      metric_type: 'response_time',
      metric_value: responseTime,
      metadata: JSON.stringify({
        endpoint: req.path,
        method: req.method
      })
    });

    // Record errors
    if (res.statusCode >= 400) {
      await databaseService.recordAnalytic({
        date: today,
        metric_type: 'errors',
        metric_value: 1,
        metadata: JSON.stringify({
          status_code: res.statusCode,
          endpoint: req.path,
          method: req.method
        })
      });
    }

    // Record token usage if available
    const tokens = extractTokensFromResponse(res);
    if (tokens) {
      await databaseService.recordAnalytic({
        date: today,
        metric_type: 'tokens',
        metric_value: tokens,
        metadata: JSON.stringify({
          model: req.body?.model,
          endpoint: req.path
        })
      });
    }

    // Record model usage
    if (req.body?.model) {
      await databaseService.recordAnalytic({
        date: today,
        metric_type: `model_${req.body.model}`,
        metric_value: 1,
        metadata: JSON.stringify({
          endpoint: req.path,
          method: req.method
        })
      });
    }
  } catch (error) {
    logger.error('Failed to record analytics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Cleanup old logs periodically
export function startLogCleanup(): void {
  const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
  const maxLogAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  setInterval(async () => {
    try {
      const cutoffDate = new Date(Date.now() - maxLogAge).toISOString();
      
      // This would require additional methods in the database service
      // For now, we'll just log the cleanup attempt
      logger.info('Log cleanup would run here', { cutoffDate });
      
      // TODO: Implement log cleanup in database service
      // await databaseService.deleteOldLogs(cutoffDate);
    } catch (error) {
      logger.error('Failed to cleanup old logs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, cleanupInterval);
}
