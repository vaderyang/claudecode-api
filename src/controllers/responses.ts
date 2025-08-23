import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ResponseRequest, ResponseObject, ResponseStreamEvent } from '../types/responses';
import { claudeCodeService } from '../services';
import { authenticateApiKey, validateResponsesRequest } from '../middleware';
import { formatSSE } from '../utils/transformers';
import logger from '../utils/logger';

const router = Router();

// Create a new response
router.post('/', authenticateApiKey, validateResponsesRequest, async (req: Request, res: Response): Promise<void> => {
  const request = req.body as ResponseRequest;
  const responseId = uuidv4();

  logger.info('Processing Responses API request', {
    responseId,
    model: request.model,
    messageCount: request.messages?.length || 0,
    stream: request.stream || false,
    hasTools: !!(request.tools && request.tools.length > 0),
    hasReasoning: !!(request as any).reasoning
  });

  // Debug: Log the normalized messages
  console.log('Normalized messages:', JSON.stringify(request.messages, null, 2));

  try {
    // Transform messages to Claude Code format
    let prompt = '';
    let context = '';

    request.messages.forEach((message) => {
      if (message.role === 'system') {
        context += `${message.content}\n`;
      } else if (message.role === 'user') {
        prompt += `User: ${message.content}\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n`;
      }
    });

    const claudeRequest = {
      prompt: prompt.trim(),
      context: context.trim() || undefined as string | undefined,
      sessionId: request.metadata?.session_id || responseId
    };

    if (request.stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const streamGenerator = claudeCodeService.processStreamRequest(claudeRequest, request.reasoning || false);
        let messageId = uuidv4();
        let contentBuffer = '';
        let outputIndex = 0;

        // Send response created event
        res.write(`event: response.created\ndata: ${JSON.stringify({
          type: 'response.created',
          response: {
            id: responseId,
            object: 'response',
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            status: 'in_progress'
          }
        })}\n\n`);

        // Send output item added event
        res.write(`event: response.output_item.added\ndata: ${JSON.stringify({
          type: 'response.output_item.added',
          output_index: outputIndex,
          item: {
            id: messageId,
            type: 'message',
            role: 'assistant',
            content: []
          }
        })}\n\n`);

        for await (const chunk of streamGenerator) {
          if (chunk.type === 'content') {
            contentBuffer += chunk.data;
            
            // Send text delta event
            res.write(`event: response.output_text.delta\ndata: ${JSON.stringify({
              type: 'response.output_text.delta',
              delta: chunk.data
            })}\n\n`);

          } else if (chunk.type === 'reasoning') {
            // Send reasoning summary delta event
            res.write(`event: response.reasoning_summary.delta\ndata: ${JSON.stringify({
              type: 'response.reasoning_summary.delta',
              delta: {
                type: chunk.reasoning?.type || 'progress',
                summary: chunk.reasoning?.summary || '',
                details: chunk.reasoning?.details
              }
            })}\n\n`);

          } else if (chunk.type === 'error') {
            res.write(`event: error\ndata: ${JSON.stringify({
              type: 'error',
              code: 'internal_error',
              message: chunk.data,
              sequence_number: 1
            })}\n\n`);
            break;
          } else if (chunk.type === 'done') {
            // Send output item done event
            res.write(`event: response.output_item.done\ndata: ${JSON.stringify({
              type: 'response.output_item.done',
              output_index: outputIndex,
              item: {
                id: messageId,
                type: 'message',
                role: 'assistant',
                content: [{
                  type: 'text',
                  text: contentBuffer
                }]
              }
            })}\n\n`);

            // Send response completed event
            res.write(`event: response.completed\ndata: ${JSON.stringify({
              type: 'response.completed',
              response: {
                id: responseId,
                object: 'response',
                created: Math.floor(Date.now() / 1000),
                model: request.model,
                status: 'completed',
                output: [{
                  id: messageId,
                  type: 'message', 
                  role: 'assistant',
                  content: [{
                    type: 'text',
                    text: contentBuffer
                  }]
                }],
                usage: {
                  prompt_tokens: Math.floor(prompt.length / 4),
                  completion_tokens: Math.floor(contentBuffer.length / 4),
                  total_tokens: Math.floor((prompt.length + contentBuffer.length) / 4)
                }
              }
            })}\n\n`);
            
            res.write(`event: done\ndata: [DONE]\n\n`);
            break;
          }
        }
      } catch (error) {
        logger.error('Error in Responses API streaming', {
          responseId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        const errorEvent: ResponseStreamEvent = {
          id: responseId,
          object: 'response.delta',
          created: Math.floor(Date.now() / 1000),
          delta: {
            status: 'failed'
          }
        };
        res.write(`event: error\n${formatSSE(errorEvent)}`);
      }

      res.end();
    } else {
      // Non-streaming response
      const claudeResponse = await claudeCodeService.processRequest(claudeRequest);
      const messageId = uuidv4();
      
      // Check if this is a title generation request and clean the response
      let responseText = claudeResponse.response;
      const isTitleGeneration = prompt.toLowerCase().includes('generate a concise chat title');
      
      if (isTitleGeneration) {
        // Remove markdown code blocks from title generation responses
        responseText = responseText.replace(/```json\n|```\n|```/g, '').trim();
        logger.debug('Cleaned title generation response', {
          responseId,
          original: claudeResponse.response,
          cleaned: responseText
        });
      }

      const responseObject: ResponseObject = {
        id: responseId,
        object: 'response',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        status: 'completed',
        messages: [{
          id: messageId,
          object: 'message',
          created: Math.floor(Date.now() / 1000),
          role: 'assistant',
          content: [{
            type: 'text',
            text: {
              value: responseText
            }
          }]
        }],
        usage: {
          prompt_tokens: claudeResponse.metadata?.tokensUsed || Math.floor(prompt.length / 4),
          completion_tokens: Math.floor(claudeResponse.response.length / 4),
          total_tokens: (claudeResponse.metadata?.tokensUsed || Math.floor(prompt.length / 4)) + Math.floor(claudeResponse.response.length / 4)
        },
        metadata: request.metadata
      };

      logger.info('Responses API completion successful', {
        responseId,
        responseLength: claudeResponse.response.length,
        tokensUsed: claudeResponse.metadata?.tokensUsed
      });

      res.json(responseObject);
    }
  } catch (error) {
    logger.error('Error processing Responses API request', {
      responseId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'api_error',
          code: '500'
        }
      });
    }
  }
});

// Get a specific response (placeholder for future implementation)
router.get('/:responseId', authenticateApiKey, (req: Request, res: Response): void => {
  const responseId = req.params['responseId'];
  
  logger.info('Get response request', { responseId });
  
  res.status(501).json({
    error: {
      message: 'Response retrieval not yet implemented',
      type: 'not_implemented_error',
      code: '501'
    }
  });
});

// List responses (placeholder for future implementation)
router.get('/', authenticateApiKey, (_req: Request, res: Response): void => {
  logger.info('List responses request');
  
  res.status(501).json({
    error: {
      message: 'Response listing not yet implemented',
      type: 'not_implemented_error', 
      code: '501'
    }
  });
});

export default router;