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