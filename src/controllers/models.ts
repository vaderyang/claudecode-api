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

import { Router, Request, Response } from 'express';
import { ModelsResponse, Model } from '../types';
import { authenticateApiKey } from '../middleware';
import logger from '../utils/logger';

const router = Router();

const availableModels: Model[] = [
  {
    id: 'claudecode-v1',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'claudecode-v1',
    parent: null
  }
];

router.get('/', authenticateApiKey, (_req: Request, res: Response): void => {
  logger.info('Models endpoint accessed');
  
  const response: ModelsResponse = {
    object: 'list',
    data: availableModels
  };

  res.json(response);
});

router.get('/:model', authenticateApiKey, (req: Request, res: Response): void => {
  const modelId = req.params['model'];
  logger.info('Model detail endpoint accessed', { modelId });
  
  const model = availableModels.find(m => m.id === modelId);
  
  if (!model) {
    res.status(404).json({
      error: {
        message: `Model '${modelId}' not found`,
        type: 'invalid_request_error',
        param: 'model',
        code: 'model_not_found'
      }
    });
    return;
  }

  res.json(model);
});

export default router;