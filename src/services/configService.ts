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

import { AppConfig } from '../types';
import { databaseService } from '../webui/database';
import logger from '../utils/logger';

class ConfigService {
  private cachedConfig: AppConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTimeout = 30000; // 30 seconds

  constructor() {
    // Base configuration from environment variables
    this.cachedConfig = {
      port: parseInt(process.env['PORT'] || '3000', 10),
      nodeEnv: process.env['NODE_ENV'] || 'development',
      requireOpenAiKey: process.env['OPENAI_API_KEY_REQUIRED'] === 'true',
      logLevel: process.env['LOG_LEVEL'] || 'info',
      corsOrigin: process.env['CORS_ORIGIN'] || '*'
    };
  }

  async getConfig(): Promise<AppConfig> {
    const now = Date.now();
    
    // Return cached config if it's still valid
    if (this.cachedConfig && (now - this.cacheTimestamp) < this.cacheTimeout) {
      return this.cachedConfig;
    }

    try {
      // Ensure database is initialized before accessing it
      await databaseService.initialize();
      
      // Get database configuration
      const dbConfig = await databaseService.getAllConfig();
      
      // Merge environment config with database config (database values take precedence)
      const mergedConfig: AppConfig = {
        port: parseInt(process.env['PORT'] || '3000', 10), // Port cannot be changed at runtime
        nodeEnv: process.env['NODE_ENV'] || 'development', // Node env cannot be changed at runtime
        requireOpenAiKey: dbConfig['requireOpenAiKey'] !== undefined ? dbConfig['requireOpenAiKey'] : (process.env['OPENAI_API_KEY_REQUIRED'] === 'true'),
        logLevel: dbConfig['logLevel'] || process.env['LOG_LEVEL'] || 'info',
        corsOrigin: dbConfig['corsOrigin'] || process.env['CORS_ORIGIN'] || '*'
      };

      // Update cache
      this.cachedConfig = mergedConfig;
      this.cacheTimestamp = now;

      return mergedConfig;
    } catch (error) {
      logger.error('Failed to load configuration from database, using environment variables', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      // Return environment-only config if database fails
      const fallbackConfig: AppConfig = {
        port: parseInt(process.env['PORT'] || '3000', 10),
        nodeEnv: process.env['NODE_ENV'] || 'development',
        requireOpenAiKey: process.env['OPENAI_API_KEY_REQUIRED'] === 'true',
        logLevel: process.env['LOG_LEVEL'] || 'info',
        corsOrigin: process.env['CORS_ORIGIN'] || '*'
      };
      
      // Cache the fallback config to avoid repeated database calls
      this.cachedConfig = fallbackConfig;
      this.cacheTimestamp = now;
      
      return fallbackConfig;
    }
  }

  async updateConfig(updates: Partial<AppConfig>, updatedBy?: string): Promise<void> {
    try {
      // Ensure database is initialized before accessing it
      await databaseService.initialize();
      
      // Save updatable configuration to database
      const promises: Promise<void>[] = [];

      if (updates.requireOpenAiKey !== undefined) {
        promises.push(
          databaseService.setConfigValue('requireOpenAiKey', updates.requireOpenAiKey.toString(), 'boolean', updatedBy)
        );
      }

      if (updates.logLevel !== undefined) {
        promises.push(
          databaseService.setConfigValue('logLevel', updates.logLevel, 'string', updatedBy)
        );
      }

      if (updates.corsOrigin !== undefined) {
        promises.push(
          databaseService.setConfigValue('corsOrigin', updates.corsOrigin, 'string', updatedBy)
        );
      }

      await Promise.all(promises);
      
      // Clear cache to force reload on next access
      this.clearCache();

      logger.info('Configuration updated', { updates, updatedBy });
    } catch (error) {
      logger.error('Failed to update configuration', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        updates,
        updatedBy 
      });
      throw error;
    }
  }

  clearCache(): void {
    this.cacheTimestamp = 0;
  }

  // Get current config synchronously (returns cached version)
  getCurrentConfig(): AppConfig {
    if (!this.cachedConfig) {
      // Return default environment config if no cache
      return {
        port: parseInt(process.env['PORT'] || '3000', 10),
        nodeEnv: process.env['NODE_ENV'] || 'development',
        requireOpenAiKey: process.env['OPENAI_API_KEY_REQUIRED'] === 'true',
        logLevel: process.env['LOG_LEVEL'] || 'info',
        corsOrigin: process.env['CORS_ORIGIN'] || '*'
      };
    }
    return this.cachedConfig;
  }
}

export const configService = new ConfigService();
