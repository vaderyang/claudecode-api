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
import { AppError } from '../utils/errors';
import { ErrorResponse } from '../types';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(err.message, { 
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Check for AppError instances (including AuthenticationError)
  if (err instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        message: err.message,
        type: err.constructor.name === 'AuthenticationError' ? 'authentication_error' : 'invalid_request_error',
        code: err.statusCode.toString()
      }
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Check for authentication errors by name (fallback)
  if (err.name === 'AuthenticationError' || err.message.includes('Authorization header') || err.message.includes('API key')) {
    const errorResponse: ErrorResponse = {
      error: {
        message: err.message,
        type: 'authentication_error'
      }
    };
    res.status(401).json(errorResponse);
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
