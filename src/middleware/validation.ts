import { Request, Response, NextFunction } from 'express';
import { ChatCompletionRequest } from '../types';

export const validateChatCompletionRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { model, messages } = req.body as ChatCompletionRequest;

  // Debug logging to see what's actually being sent
  console.log('Chat Completions request body:', JSON.stringify(req.body, null, 2));
  console.log('Messages type:', typeof messages, 'Array:', Array.isArray(messages));

  if (!model) {
    res.status(400).json({
      error: {
        message: 'Model is required',
        type: 'invalid_request_error',
        param: 'model'
      }
    });
    return;
  }

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({
      error: {
        message: 'Messages must be an array',
        type: 'invalid_request_error',
        param: 'messages'
      }
    });
    return;
  }

  if (messages.length === 0) {
    res.status(400).json({
      error: {
        message: 'Messages array cannot be empty',
        type: 'invalid_request_error',
        param: 'messages'
      }
    });
    return;
  }

  for (const [index, message] of messages.entries()) {
    if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
      res.status(400).json({
        error: {
          message: `Invalid role at message index ${index}`,
          type: 'invalid_request_error',
          param: `messages[${index}].role`
        }
      });
      return;
    }

    if (typeof message.content !== 'string') {
      res.status(400).json({
        error: {
          message: `Content must be a string at message index ${index}`,
          type: 'invalid_request_error',
          param: `messages[${index}].content`
        }
      });
      return;
    }
  }

  next();
};

export const validateResponsesRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { model, messages, input } = req.body;

  // Debug logging to see what's actually being sent
  console.log('Responses API request body:', JSON.stringify(req.body, null, 2));

  if (!model) {
    res.status(400).json({
      error: {
        message: 'Model is required',
        type: 'invalid_request_error',
        param: 'model'
      }
    });
    return;
  }

  // Support both 'messages' and 'input' formats
  const messageArray = messages || input;
  
  if (!messageArray || !Array.isArray(messageArray)) {
    res.status(400).json({
      error: {
        message: 'Messages or input must be an array',
        type: 'invalid_request_error',
        param: messages ? 'messages' : 'input'
      }
    });
    return;
  }

  if (messageArray.length === 0) {
    res.status(400).json({
      error: {
        message: 'Messages array cannot be empty',
        type: 'invalid_request_error',
        param: messages ? 'messages' : 'input'
      }
    });
    return;
  }

  // Normalize the request format - convert 'input' to 'messages' if needed
  if (input && !messages) {
    req.body.messages = input.map((item: any) => {
      // Handle complex content structures
      let content = item.content;
      if (Array.isArray(content)) {
        // Extract text from complex content structure
        content = content.map((c: any) => {
          if (c.type === 'input_text') {
            return c.text;
          }
          return c.text || c.content || '';
        }).join(' ');
      }

      // Normalize role names
      let role = item.role;
      if (role === 'developer') {
        role = 'system';
      }

      return {
        role: role,
        content: content
      };
    });
  }

  next();
};