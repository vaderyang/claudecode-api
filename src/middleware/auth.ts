import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../utils/errors';
import { config } from '../config';

export const authenticateApiKey = (req: Request, _res: Response, next: NextFunction): void => {
  if (!config.requireOpenAiKey) {
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

  req.headers['x-api-key'] = token;
  next();
};