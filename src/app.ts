import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware';
import logger from './utils/logger';
import chatRouter from './controllers/chat';
import modelsRouter from './controllers/models';
import healthRouter from './controllers/health';
import responsesRouter from './controllers/responses';

const app = express();

app.use(helmet());

app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    }
  }
}));

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