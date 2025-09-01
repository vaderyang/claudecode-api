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

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware';
import logger from './utils/logger';
import chatRouter from './controllers/chat';
import modelsRouter from './controllers/models';
import healthRouter from './controllers/health';
import responsesRouter from './controllers/responses';
import webUIController from './webui/controllers';
import { databaseService } from './webui/database';
import { authService } from './webui/auth';
import { requestLogger, startLogCleanup } from './webui/logging';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline styles
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for inline scripts
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      fontSrc: [
        "'self'",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:"
      ],
      connectSrc: [
        "'self'"
      ]
    }
  }
}));

app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database and auth
const initializeWebUI = async () => {
  try {
    await databaseService.initialize();
    await authService.createDefaultUser();
    startLogCleanup();
    logger.info('WebUI initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize WebUI', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

initializeWebUI();

// Session configuration for WebUI
app.use(session({
  secret: process.env['SESSION_SECRET'] || 'claude-code-api-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Add request logging middleware
app.use(requestLogger);

const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    }
  }
}));

// WebUI routes
app.use('/api/webui', webUIController);
app.use('/webui', express.static(path.join(__dirname, '../webui/public')));
app.get('/webui', (_req, res) => {
  res.sendFile(path.join(__dirname, '../webui/public/index.html'));
});

app.use('/v1/chat', chatRouter);
app.use('/v1/models', modelsRouter);
app.use('/v1/responses', responsesRouter);
app.use('/health', healthRouter);

app.get('/', (_req, res) => {
  res.json({
    message: 'Claude Code API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      chat: '/v1/chat/completions',
      models: '/v1/models',
      responses: '/v1/responses',
      health: '/health'
    }
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.originalUrl} not found`,
      type: 'invalid_request_error'
    }
  });
});

app.use(errorHandler);

export default app;