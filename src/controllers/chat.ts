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
import { v4 as uuidv4 } from 'uuid';
import { ChatCompletionRequest } from '../types';
import { claudeCodeService, claudeApiService } from '../services';
import { 
  transformOpenAIToClaude, 
  transformClaudeToOpenAI, 
  createStreamChunk, 
  formatSSE 
} from '../utils/transformers';
import { authenticateApiKey, validateChatCompletionRequest } from '../middleware';
import logger from '../utils/logger';
import { generateProgressiveReasoningTips, generateContextualReasoningTip } from '../utils/instantReasoning';

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

      // Choose service based on model
      const isClaudeApiModel = request.model === 'claude-4-sonnet';
      const service = isClaudeApiModel ? claudeApiService : claudeCodeService;

      if (request.stream) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

        try {
          let streamGenerator;
          
          // Choose processing approach based on service type
          if (!isClaudeApiModel) {
            // PHASE 1: Stream instant reasoning tips while Claude Code initializes
            logger.info('Phase 1: Streaming instant reasoning tips', { requestId });
            
            // Get user prompt from the latest message
            const userMessages = request.messages.filter(msg => msg.role === 'user');
            const lastMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
            const latestPrompt = lastMessage ? lastMessage.content : '';
            
            // Stream progressive reasoning tips immediately
            const instantReasoningGenerator = generateProgressiveReasoningTips(latestPrompt);
            
            // Start Claude Code processing in parallel (don't await yet)
            const claudeCodePromise = (async () => {
              logger.info('Phase 2: Starting Claude Code SDK processing', { requestId });
              return claudeCodeService.processStreamRequest(claudeRequest, true);
            })();
            
            // Stream instant reasoning tips first
            for await (const tip of instantReasoningGenerator) {
              const reasoningText = `💭 ${tip.summary}`;
              const reasoningChunk = createStreamChunk(reasoningText, requestId, request.model);
              res.write(formatSSE(reasoningChunk));
            }
            
            // Add contextual reasoning tip
            const contextualTip = generateContextualReasoningTip(latestPrompt);
            const contextualText = `💭 ${contextualTip.summary}`;
            const contextualChunk = createStreamChunk(contextualText, requestId, request.model);
            res.write(formatSSE(contextualChunk));
            
            // PHASE 2: Process actual Claude Code response
            logger.info('Phase 2: Processing Claude Code response', { requestId });
            streamGenerator = await claudeCodePromise;
            
            // Add transition message
            const transitionText = `\n\n🔄 **Starting Claude Code processing...**\n\n`;
            const transitionChunk = createStreamChunk(transitionText, requestId, request.model);
            res.write(formatSSE(transitionChunk));
          } else {
            // For Claude API service, use direct streaming without instant reasoning
            streamGenerator = service.processStreamRequest(claudeRequest);
          }
          
          for await (const chunk of streamGenerator) {
            if (chunk.type === 'content') {
              const streamChunk = createStreamChunk(chunk.data, requestId, request.model);
              res.write(formatSSE(streamChunk));
            } else if (chunk.type === 'reasoning') {
              // Stream additional reasoning information from Claude Code
              const reasoningText = `💭 ${chunk.reasoning?.summary || 'Processing...'}`;
              const reasoningChunk = createStreamChunk(reasoningText, requestId, request.model);
              res.write(formatSSE(reasoningChunk));
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
            model: request.model,
            service: isClaudeApiModel ? 'claude-api' : 'claude-code',
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
        const claudeResponse = await service.processRequest(claudeRequest);
        const openaiResponse = transformClaudeToOpenAI(claudeResponse, request, requestId);

        logger.info('Chat completion successful', {
          requestId,
          model: request.model,
          service: isClaudeApiModel ? 'claude-api' : 'claude-code',
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