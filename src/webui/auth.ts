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
import bcrypt from 'bcrypt';
import { databaseService, WebUIUser } from './database';
import logger from '../utils/logger';

// Extend Express session to include user data
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      role: string;
    };
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async createDefaultUser(): Promise<void> {
    try {
      // Check if any users exist
      const existingUser = await databaseService.getWebUIUserByUsername('admin');
      
      if (!existingUser) {
        const defaultPassword = process.env['WEBUI_DEFAULT_PASSWORD'] || 'admin123';
        const hashedPassword = await this.hashPassword(defaultPassword);
        
        await databaseService.createWebUIUser({
          username: 'admin',
          password_hash: hashedPassword,
          is_active: true,
          role: 'admin'
        });

        logger.info('Default admin user created', { 
          username: 'admin',
          defaultPassword: process.env['WEBUI_DEFAULT_PASSWORD'] ? '[from env]' : 'admin123'
        });
      }
    } catch (error) {
      logger.error('Failed to create default user', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async authenticateUser(username: string, password: string): Promise<WebUIUser | null> {
    try {
      const user = await databaseService.getWebUIUserByUsername(username);
      
      if (!user || !user.is_active) {
        return null;
      }

      const isValid = await this.verifyPassword(password, user.password_hash);
      
      if (isValid) {
        // Update last login
        await databaseService.updateWebUIUser(user.id, {
          last_login: new Date().toISOString()
        });
        
        return user;
      }

      return null;
    } catch (error) {
      logger.error('Authentication error', {
        username,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
}

export const authService = new AuthService();

// Middleware to check if user is authenticated
export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.session?.user) {
    res.status(401).json({
      error: {
        message: 'Authentication required',
        type: 'authentication_error'
      }
    });
    return;
  }

  req.user = req.session.user;
  next();
};

// Middleware to check if user has admin role
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      error: {
        message: 'Admin role required',
        type: 'authorization_error'
      }
    });
    return;
  }

  next();
};

// Rate limiting for authentication attempts
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const authRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const attempts = authAttempts.get(ip);
  
  if (attempts) {
    // Reset counter if window has passed
    if (now - attempts.lastAttempt > windowMs) {
      authAttempts.delete(ip);
    } else if (attempts.count >= maxAttempts) {
      res.status(429).json({
        error: {
          message: 'Too many authentication attempts. Please try again later.',
          type: 'rate_limit_error',
          retryAfter: Math.ceil((windowMs - (now - attempts.lastAttempt)) / 1000)
        }
      });
      return;
    }
  }

  next();
};

export const recordAuthAttempt = (req: Request, success: boolean): void => {
  if (success) return; // Only record failed attempts

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  const attempts = authAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count += 1;
  attempts.lastAttempt = now;
  authAttempts.set(ip, attempts);
};

// Clean up old auth attempts every hour
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  
  for (const [ip, attempts] of authAttempts.entries()) {
    if (now - attempts.lastAttempt > windowMs) {
      authAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000);
