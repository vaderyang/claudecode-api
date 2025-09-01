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

import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  permissions: string; // JSON string
  rate_limit: number; // requests per minute
  description?: string;
  last_used?: string;
  usage_count: number;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  api_key_id?: string | undefined;
  endpoint: string;
  method: string;
  model?: string | undefined;
  status_code: number;
  request_body?: string | undefined; // JSON string
  response_body?: string | undefined; // JSON string
  response_time: number; // in milliseconds
  tokens_used?: number | undefined;
  ip_address?: string | undefined;
  user_agent?: string | undefined;
  error_message?: string | undefined;
}

export interface Analytics {
  id: string;
  date: string; // YYYY-MM-DD format
  metric_type: string; // 'requests', 'tokens', 'errors', etc.
  metric_value: number;
  metadata?: string; // JSON string for additional data
}

export interface WebUIUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  role: string; // 'admin', 'viewer'
}

class DatabaseService {
  private db: Database;
  private dbPath: string;
  private initialized = false;

  constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.dbPath = path.join(dataDir, 'webui.sqlite');
    this.db = new sqlite3.Database(this.dbPath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Create API Keys table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            permissions TEXT NOT NULL DEFAULT '{}',
            rate_limit INTEGER NOT NULL DEFAULT 60,
            description TEXT,
            last_used TEXT,
            usage_count INTEGER NOT NULL DEFAULT 0
          )
        `);

        // Create Request Logs table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS request_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            api_key_id TEXT,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            model TEXT,
            status_code INTEGER NOT NULL,
            request_body TEXT,
            response_body TEXT,
            response_time INTEGER NOT NULL,
            tokens_used INTEGER,
            ip_address TEXT,
            user_agent TEXT,
            error_message TEXT,
            FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
          )
        `);

        // Create Analytics table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS analytics (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            metric_value INTEGER NOT NULL,
            metadata TEXT DEFAULT '{}',
            UNIQUE(date, metric_type)
          )
        `);

        // Create WebUI Users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS webui_users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_login TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            role TEXT NOT NULL DEFAULT 'viewer'
          )
        `);

        // Create Configuration table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS configuration (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'string',
            updated_at TEXT NOT NULL,
            updated_by TEXT
          )
        `, (err) => {
          if (err) {
            logger.error('Failed to create database tables', { error: err.message });
            reject(err);
          } else {
            this.createIndexes().then(() => {
              this.initialized = true;
              logger.info('Database initialized successfully', { path: this.dbPath });
              resolve();
            }).catch(reject);
          }
        });
      });
    });
  }

  private async createIndexes(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Indexes for request_logs table for efficient querying
        this.db.run('CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_id ON request_logs(api_key_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON request_logs(status_code)');
        
        // Indexes for analytics table
        this.db.run('CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_analytics_metric_type ON analytics(metric_type)');
        
        // Indexes for api_keys table
        this.db.run('CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used)', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  // API Key Management
  async createApiKey(apiKey: Omit<ApiKey, 'id' | 'created_at' | 'usage_count'>): Promise<ApiKey> {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const created_at = new Date().toISOString();
    const usage_count = 0;

    const newApiKey: ApiKey = {
      id,
      created_at,
      usage_count,
      ...apiKey
    };

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO api_keys (
          id, key, name, created_at, expires_at, is_active,
          permissions, rate_limit, description, last_used, usage_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        newApiKey.id,
        newApiKey.key,
        newApiKey.name,
        newApiKey.created_at,
        newApiKey.expires_at || null,
        newApiKey.is_active ? 1 : 0,
        newApiKey.permissions,
        newApiKey.rate_limit,
        newApiKey.description || null,
        newApiKey.last_used || null,
        newApiKey.usage_count
      ], function(err) {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(newApiKey);
        }
      });
    });
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM api_keys ORDER BY created_at DESC', (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const apiKeys = rows.map(row => ({
            ...row,
            is_active: Boolean(row.is_active)
          }));
          resolve(apiKeys);
        }
      });
    });
  }

  async getApiKeyByKey(key: string): Promise<ApiKey | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM api_keys WHERE key = ?', [key], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            is_active: Boolean(row.is_active)
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async updateApiKey(id: string, updates: Partial<ApiKey>): Promise<void> {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => updates[key as keyof ApiKey]);
    
    values.push(id);

    return new Promise((resolve, reject) => {
      this.db.run(`UPDATE api_keys SET ${setClause} WHERE id = ?`, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async deleteApiKey(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM api_keys WHERE id = ?', [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Request Logging
  async logRequest(log: Omit<RequestLog, 'id'>): Promise<void> {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO request_logs (
          id, timestamp, api_key_id, endpoint, method, model,
          status_code, request_body, response_body, response_time,
          tokens_used, ip_address, user_agent, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        id,
        log.timestamp,
        log.api_key_id || null,
        log.endpoint,
        log.method,
        log.model || null,
        log.status_code,
        log.request_body || null,
        log.response_body || null,
        log.response_time,
        log.tokens_used || null,
        log.ip_address || null,
        log.user_agent || null,
        log.error_message || null
      ], function(err) {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getRequestLogs(options: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    apiKeyId?: string;
    endpoint?: string;
    statusCode?: number;
  } = {}): Promise<{ logs: RequestLog[]; total: number }> {
    const {
      page = 1,
      limit = 100,
      startDate,
      endDate,
      apiKeyId,
      endpoint,
      statusCode
    } = options;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(endDate);
    }

    if (apiKeyId) {
      whereClause += ' AND api_key_id = ?';
      params.push(apiKeyId);
    }

    if (endpoint) {
      whereClause += ' AND endpoint LIKE ?';
      params.push(`%${endpoint}%`);
    }

    if (statusCode) {
      whereClause += ' AND status_code = ?';
      params.push(statusCode);
    }

    const offset = (page - 1) * limit;

    return new Promise((resolve, reject) => {
      // Get total count
      this.db.get(`SELECT COUNT(*) as count FROM request_logs ${whereClause}`, params, (err, countRow: any) => {
        if (err) {
          reject(err);
          return;
        }

        const total = countRow.count;

        // Get logs with pagination
        this.db.all(
          `SELECT * FROM request_logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset],
          (err, rows: any[]) => {
            if (err) {
              reject(err);
            } else {
              resolve({ logs: rows, total });
            }
          }
        );
      });
    });
  }

  // Analytics
  async recordAnalytic(metric: Omit<Analytics, 'id'>): Promise<void> {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    
    return new Promise((resolve, reject) => {
      // Try to insert first, and handle duplicate key error
      const insertStmt = this.db.prepare(`
        INSERT INTO analytics (id, date, metric_type, metric_value, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);

      const self = this; // Store reference to this for use in nested callbacks
      
      insertStmt.run([
        id,
        metric.date,
        metric.metric_type,
        metric.metric_value,
        metric.metadata || '{}'
      ], function(insertErr: any) {
        insertStmt.finalize();
        
        // If insert failed due to unique constraint violation, update instead
        if (insertErr && (insertErr.code === 'SQLITE_CONSTRAINT' || insertErr.message?.includes('UNIQUE constraint failed'))) {
          const updateStmt = self.db.prepare(`
            UPDATE analytics SET 
              metric_value = metric_value + ?,
              metadata = ?
            WHERE date = ? AND metric_type = ?
          `);

          updateStmt.run([
            metric.metric_value,
            metric.metadata || '{}',
            metric.date,
            metric.metric_type
          ], function(updateErr) {
            updateStmt.finalize();
            if (updateErr) {
              reject(updateErr);
            } else {
              resolve();
            }
          });
        } else if (insertErr) {
          // Some other error occurred
          reject(insertErr);
        } else {
          // Insert was successful
          resolve();
        }
      });
    });
  }

  async getAnalytics(startDate: string, endDate: string, metricTypes?: string[]): Promise<Analytics[]> {
    let query = 'SELECT * FROM analytics WHERE date >= ? AND date <= ?';
    const params: any[] = [startDate, endDate];

    if (metricTypes && metricTypes.length > 0) {
      const placeholders = metricTypes.map(() => '?').join(', ');
      query += ` AND metric_type IN (${placeholders})`;
      params.push(...metricTypes);
    }

    query += ' ORDER BY date ASC, metric_type ASC';

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // WebUI User Management
  async createWebUIUser(user: Omit<WebUIUser, 'id' | 'created_at'>): Promise<WebUIUser> {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    const created_at = new Date().toISOString();

    const newUser: WebUIUser = {
      id,
      created_at,
      ...user
    };

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO webui_users (id, username, password_hash, created_at, last_login, is_active, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        newUser.id,
        newUser.username,
        newUser.password_hash,
        newUser.created_at,
        newUser.last_login || null,
        newUser.is_active ? 1 : 0,
        newUser.role
      ], function(err) {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve(newUser);
        }
      });
    });
  }

  async getWebUIUserByUsername(username: string): Promise<WebUIUser | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM webui_users WHERE username = ?', [username], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            is_active: Boolean(row.is_active)
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async updateWebUIUser(id: string, updates: Partial<WebUIUser>): Promise<void> {
    const setClause = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => updates[key as keyof WebUIUser]);
    
    values.push(id);

    return new Promise((resolve, reject) => {
      this.db.run(`UPDATE webui_users SET ${setClause} WHERE id = ?`, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Configuration Management
  async getConfigValue(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT value FROM configuration WHERE key = ?', [key], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.value : null);
        }
      });
    });
  }

  async setConfigValue(key: string, value: string, type: string = 'string', updatedBy?: string): Promise<void> {
    const updated_at = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
      // Use INSERT OR REPLACE to handle both insert and update
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO configuration (key, value, type, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run([key, value, type, updated_at, updatedBy || null], function(err) {
        stmt.finalize();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getAllConfig(): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT key, value, type FROM configuration', (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const config: Record<string, any> = {};
          rows.forEach(row => {
            // Convert string values back to their original types
            switch (row.type) {
              case 'boolean':
                config[row.key] = row.value === 'true';
                break;
              case 'number':
                config[row.key] = parseInt(row.value, 10);
                break;
              default:
                config[row.key] = row.value;
            }
          });
          resolve(config);
        }
      });
    });
  }

  async deleteConfigValue(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM configuration WHERE key = ?', [key], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export const databaseService = new DatabaseService();
