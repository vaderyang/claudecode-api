/**
 * MIT License
 * 
 * Copyright (c) 2025 Claude Code API
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

import app from './app';
import { config, validateConfig } from './config';
import logger from './utils/logger';

const startServer = async (): Promise<void> => {
  try {
    validateConfig();
    
    const server = app.listen(config.port, () => {
      logger.info(`Claude Code API server starting`, {
        port: config.port,
        environment: config.nodeEnv,
        logLevel: config.logLevel
      });
      
      logger.info(`Server endpoints available at:`);
      logger.info(`  Health: http://localhost:${config.port}/health`);
      logger.info(`  Models: http://localhost:${config.port}/v1/models`);
      logger.info(`  Chat: http://localhost:${config.port}/v1/chat/completions`);
      logger.info(`  Responses: http://localhost:${config.port}/v1/responses`);
    });

    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      
      setTimeout(() => {
        logger.error('Forceful shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    logger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

export { app, startServer };