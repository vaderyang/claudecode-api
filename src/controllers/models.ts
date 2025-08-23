import { Router, Request, Response } from 'express';
import { ModelsResponse, Model } from '../types';
import { authenticateApiKey } from '../middleware';
import logger from '../utils/logger';

const router = Router();

const availableModels: Model[] = [
  {
    id: 'claude-code-v1',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'claude-code-v1',
    parent: null
  },
  {
    id: 'gpt-3.5-turbo',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'gpt-3.5-turbo',
    parent: null
  },
  {
    id: 'gpt-4',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'gpt-4',
    parent: null
  },
  {
    id: 'gpt-4-turbo',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'gpt-4-turbo',
    parent: null
  },
  {
    id: 'gpt-4o',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'gpt-4o',
    parent: null
  },
  {
    id: 'gpt-4o-mini',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'gpt-4o-mini',
    parent: null
  },
  {
    id: 'o1',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'o1',
    parent: null
  },
  {
    id: 'o1-mini',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'o1-mini',
    parent: null
  },
  {
    id: 'o3',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'o3',
    parent: null
  },
  {
    id: 'o3-mini',
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'claude-code',
    permission: [],
    root: 'o3-mini',
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