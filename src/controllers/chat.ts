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
            // Collect all reasoning content first
            let allReasoningContent = '';
            
            // Get user prompt from the latest message
            const userMessages = request.messages.filter(msg => msg.role === 'user');
            const lastMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
            const latestPrompt = lastMessage ? lastMessage.content : '';
            
            // Collect instant reasoning tips
            const instantReasoningGenerator = generateProgressiveReasoningTips(latestPrompt);
            for await (const tip of instantReasoningGenerator) {
              allReasoningContent += `💭 ${tip.summary}`;
            }
            
            // Add contextual reasoning tip
            const contextualTip = generateContextualReasoningTip(latestPrompt);
            allReasoningContent += `💭 ${contextualTip.summary}`;
            
            // Add transition message
            allReasoningContent += `\n\n🔄 **Starting Claude Code processing...**\n\n`;
            
            // Start Claude Code processing
            logger.info('Starting Claude Code SDK processing', { requestId });
            streamGenerator = claudeCodeService.processStreamRequest(claudeRequest, true);
            
            // Collect Claude Code reasoning
            const reasoningBuffer: string[] = [];
            let contentStarted = false;
            
            for await (const chunk of streamGenerator) {
              if (chunk.type === 'reasoning' && !contentStarted) {
                reasoningBuffer.push(chunk.reasoning?.summary || 'Processing...');
              } else if (chunk.type === 'content') {
                // First content chunk - send all collected reasoning as single <think> block
                if (!contentStarted) {
                  contentStarted = true;
                  
                  // Add all Claude Code reasoning to the buffer
                  if (reasoningBuffer.length > 0) {
                    allReasoningContent += reasoningBuffer.join(' ');
                  }
                  
                  // Send all reasoning as one <think> block
                  if (allReasoningContent) {
                    const thinkChunk = createStreamChunk(`<think>${allReasoningContent}</think>`, requestId, request.model);
                    res.write(formatSSE(thinkChunk));
                  }
                }
                
                // Send content chunk
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
          } else {
            // For Claude API service, use direct streaming without instant reasoning
            streamGenerator = service.processStreamRequest(claudeRequest);
            
            for await (const chunk of streamGenerator) {
              if (chunk.type === 'content') {
                const streamChunk = createStreamChunk(chunk.data, requestId, request.model);
                res.write(formatSSE(streamChunk));
              } else if (chunk.type === 'reasoning') {
                // For chat completions API, embed reasoning as <think> tags in the text stream
                const reasoningText = `<think>${chunk.reasoning?.summary || 'Processing...'}</think>`;
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
        // For non-streaming, collect all reasoning first, then content
        let allReasoningContent = '';
        let actualContent = '';
        let fullContent = '';
        let totalTokensUsed = 0;
        
        try {
          if (isClaudeApiModel) {
            // For Claude API, just collect content
            const streamGenerator = service.processStreamRequest(claudeRequest);
            for await (const chunk of streamGenerator) {
              if (chunk.type === 'content') {
                actualContent += chunk.data;
              } else if (chunk.type === 'reasoning' && chunk.reasoning?.summary) {
                allReasoningContent += chunk.reasoning.summary;
              }
            }
          } else {
            // For Claude Code, collect instant reasoning + Claude Code reasoning
            const userMessages = request.messages.filter(msg => msg.role === 'user');
            const lastMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
            const latestPrompt = lastMessage ? lastMessage.content : '';
            
            // Collect instant reasoning tips
            const instantReasoningGenerator = generateProgressiveReasoningTips(latestPrompt);
            for await (const tip of instantReasoningGenerator) {
              allReasoningContent += `💭 ${tip.summary}`;
            }
            
            // Add contextual reasoning tip
            const contextualTip = generateContextualReasoningTip(latestPrompt);
            allReasoningContent += `💭 ${contextualTip.summary}`;
            
            // Add transition message
            allReasoningContent += `\n\n🔄 **Starting Claude Code processing...**\n\n`;
            
            // Collect Claude Code content and reasoning
            const streamGenerator = claudeCodeService.processStreamRequest(claudeRequest, true);
            for await (const chunk of streamGenerator) {
              if (chunk.type === 'content') {
                actualContent += chunk.data;
              } else if (chunk.type === 'reasoning' && chunk.reasoning?.summary) {
                allReasoningContent += chunk.reasoning.summary;
              }
            }
          }
          
          // Combine reasoning and content
          if (allReasoningContent) {
            fullContent += `<think>${allReasoningContent}</think>`;
          }
          fullContent += actualContent;
          
        } catch (error) {
          logger.error('Error in non-streaming processing', { requestId, error });
          throw error;
        }

        const openaiResponse = {
          id: requestId,
          object: 'chat.completion' as const,
          created: Math.floor(Date.now() / 1000),
          model: request.model || 'claude-sonnet',
          choices: [{
            index: 0,
            message: {
              role: 'assistant' as const,
              content: fullContent
            },
            finish_reason: 'stop' as const
          }],
          usage: {
            prompt_tokens: totalTokensUsed || 100,
            completion_tokens: Math.floor(fullContent.length / 4),
            total_tokens: (totalTokensUsed || 100) + Math.floor(fullContent.length / 4)
          }
        };

        logger.info('Chat completion successful', {
          requestId,
          model: request.model,
          service: isClaudeApiModel ? 'claude-api' : 'claude-code',
          responseLength: fullContent.length,
          tokensUsed: totalTokensUsed
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