import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ErrorResponse } from '../types';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  logger.error(err.message, { 
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (error instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        message: error.message,
        type: 'invalid_request_error',
        code: error.statusCode.toString()
      }
    };
    res.status(error.statusCode).json(errorResponse);
    return;
  }

  if (err.name === 'ValidationError') {
    const errorResponse: ErrorResponse = {
      error: {
        message: err.message,
        type: 'invalid_request_error'
      }
    };
    res.status(400).json(errorResponse);
    return;
  }

  const errorResponse: ErrorResponse = {
    error: {
      message: 'Internal server error',
      type: 'api_error'
    }
  };
  res.status(500).json(errorResponse);
};