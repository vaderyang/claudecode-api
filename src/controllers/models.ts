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

/**
 * @swagger
 * /v1/models:
 *   get:
 *     summary: List available models
 *     description: Lists the currently available models, and provides basic information about each one such as the owner and availability.
 *     tags:
 *       - Models
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModelsResponse'
 *             example:
 *               object: "list"
 *               data:
 *                 - id: "claudecode-v1"
 *                   object: "model"
 *                   created: 1677610602
 *                   owned_by: "claude-code"
 *                   permission: []
 *                   root: "claudecode-v1"
 *                   parent: null
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error:
 *                 message: "Invalid API key provided"
 *                 type: "authentication_error"
 */
router.get('/', authenticateApiKey, (_req: Request, res: Response): void => {
  logger.info('Models endpoint accessed');
  
  const response: ModelsResponse = {
    object: 'list',
    data: availableModels
  };

  res.json(response);
});

/**
 * @swagger
 * /v1/models/{model}:
 *   get:
 *     summary: Retrieve a model
 *     description: Retrieves information about a specific model.
 *     tags:
 *       - Models
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: model
 *         required: true
 *         description: The ID of the model to retrieve
 *         schema:
 *           type: string
 *           example: "claudecode-v1"
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Model'
 *             example:
 *               id: "claudecode-v1"
 *               object: "model"
 *               created: 1677610602
 *               owned_by: "claude-code"
 *               permission: []
 *               root: "claudecode-v1"
 *               parent: null
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error:
 *                 message: "Invalid API key provided"
 *                 type: "authentication_error"
 *       404:
 *         description: Model not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error:
 *                 message: "Model 'invalid-model' not found"
 *                 type: "invalid_request_error"
 *                 param: "model"
 *                 code: "model_not_found"
 */
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