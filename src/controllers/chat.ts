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

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatCompletionRequest } from '../types';
import { claudeCodeService } from '../services';
import { 
  transformOpenAIToClaude, 
  transformClaudeToOpenAI, 
  createStreamChunk, 
  formatSSE 
} from '../utils/transformers';
import { authenticateApiKey, validateChatCompletionRequest } from '../middleware';
import logger from '../utils/logger';

const router = Router();

router.post('/completions', 
  authenticateApiKey,
  validateChatCompletionRequest,
  async (req: Request, res: Response): Promise<void> => {
    const request = req.body as ChatCompletionRequest;
    const requestId = uuidv4();

    logger.info('Processing chat completion request', {
      requestId,
      model: request.model,
      messageCount: request.messages.length,
      stream: request.stream || false
    });

    try {
      const claudeRequest = transformOpenAIToClaude(request);
      claudeRequest.sessionId = requestId;

      if (request.stream) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        try {
          const streamGenerator = claudeCodeService.processStreamRequest(claudeRequest);
          
          for await (const chunk of streamGenerator) {
            if (chunk.type === 'content') {
              const streamChunk = createStreamChunk(chunk.data, requestId, request.model);
              res.write(formatSSE(streamChunk));
            } else if (chunk.type === 'error') {
              const errorChunk = createStreamChunk(`Error: ${chunk.data}`, requestId, request.model, true);
              res.write(formatSSE(errorChunk));
              break;
            } else if (chunk.type === 'done') {
              const doneChunk = createStreamChunk('', requestId, request.model, true);
              res.write(formatSSE(doneChunk));
              res.write('data: [DONE]\n\n');
              break;
            }
          }
        } catch (error) {
          logger.error('Error in streaming response', { 
            requestId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          const errorChunk = createStreamChunk(
            `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
            requestId, 
            request.model, 
            true
          );
          res.write(formatSSE(errorChunk));
          res.write('data: [DONE]\n\n');
        }

        res.end();
      } else {
        const claudeResponse = await claudeCodeService.processRequest(claudeRequest);
        const openaiResponse = transformClaudeToOpenAI(claudeResponse, request, requestId);

        logger.info('Chat completion successful', {
          requestId,
          responseLength: claudeResponse.response.length,
          tokensUsed: claudeResponse.metadata?.tokensUsed
        });

        res.json(openaiResponse);
      }
    } catch (error) {
      logger.error('Error processing chat completion', { 
        requestId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      if (request.stream && !res.headersSent) {
        res.setHeader('Content-Type', 'text/plain');
        const errorChunk = createStreamChunk(
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
          requestId, 
          request.model, 
          true
        );
        res.write(formatSSE(errorChunk));
        res.write('data: [DONE]\n\n');
        res.end();
      } else if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: error instanceof Error ? error.message : 'Internal server error',
            type: 'api_error',
            code: '500'
          }
        });
      }
    }
  }
);

export default router;