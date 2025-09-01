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
import { AuthenticationError } from '../utils/errors';

export const authenticateApiKey = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    // Import configService and databaseService dynamically to avoid circular dependencies
    const { configService } = await import('../services/configService');
    const currentConfig = await configService.getConfig();
    
    if (!currentConfig.requireOpenAiKey) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      throw new AuthenticationError('API key is required');
    }

    // Validate the API key against the database
    const { databaseService } = await import('../webui/database');
    await databaseService.initialize(); // Ensure database is initialized
    
    const apiKey = await databaseService.getApiKeyByKey(token);
    
    if (!apiKey) {
      throw new AuthenticationError('Invalid API key');
    }
    
    if (!apiKey.is_active) {
      throw new AuthenticationError('API key is inactive');
    }
    
    // Check if API key has expired
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      throw new AuthenticationError('API key has expired');
    }
    
    // Update last used timestamp and usage count
    await databaseService.updateApiKey(apiKey.id, {
      last_used: new Date().toISOString(),
      usage_count: apiKey.usage_count + 1
    });

    req.headers['x-api-key'] = token;
    req.headers['x-api-key-id'] = apiKey.id;
    next();
  } catch (error) {
    next(error);
  }
};
