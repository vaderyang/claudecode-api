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

import { query } from '@anthropic-ai/claude-code';
import { ClaudeCodeRequest, ClaudeCodeResponse, ClaudeCodeStreamResponse } from '../types/claude';
import { ClaudeCodeError } from '../utils/errors';
import logger from '../utils/logger';

class ClaudeApiService {
  private validateSetup(): void {
    // Claude Code SDK handles its own authentication
    // No API key validation needed
    logger.debug('Claude API service initialized - using built-in authentication', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    });
  }

  async processRequest(request: ClaudeCodeRequest): Promise<ClaudeCodeResponse> {
    try {
      this.validateSetup();

      logger.info('Processing Claude API request (pure LLM mode)', { 
        promptLength: request.prompt.length,
        hasContext: !!request.context,
        sessionId: request.sessionId 
      });

      const startTime = Date.now();
      
      // Build the query options for pure LLM mode
      // Use similar options to the working service but constrain via system prompt
      const publicDir = process.cwd() + '/public';
      const options: any = {
        cwd: publicDir,
        permissionMode: 'bypassPermissions',
        executable: 'node',
        executableArgs: []
      };
      
      // Set system prompt for pure LLM behavior - explicitly instruct not to use tools
      let systemPrompt = `You are Claude, an AI assistant created by Anthropic. You respond helpfully and accurately to user questions with text-only responses.

IMPORTANT CONSTRAINTS:
- You must NEVER use any tools, commands, or file operations
- You cannot create, read, write, or modify any files
- You cannot execute bash commands or run any code
- You cannot search the web or access external systems
- You cannot use any special functions or capabilities beyond text generation
- Respond ONLY with conversational text - no code execution, no file manipulation, no tool usage

If a user asks you to perform actions that would require tools, politely explain that you can only provide text-based responses and suggestions, but cannot perform the actual actions.`;

      if (request.context) {
        // If there's custom context, prepend our constraints to it
        systemPrompt = systemPrompt + '\n\nAdditional context: ' + request.context;
      }
      
      options.customSystemPrompt = systemPrompt;

      logger.debug('Claude API SDK query options (pure LLM mode)', {
        sessionId: request.sessionId,
        options: JSON.stringify(options, null, 2),
        promptPreview: request.prompt.substring(0, 200) + (request.prompt.length > 200 ? '...' : '')
      });

      let fullResponse = '';
      let tokensUsed = 0;
      let processingTime = 0;

      logger.info('Starting Claude API SDK query (pure LLM mode)', {
        sessionId: request.sessionId,
        timestamp: new Date().toISOString()
      });

      // Use Claude Code SDK query function in pure LLM mode
      for await (const message of query({
        prompt: request.prompt,
        options
      })) {
        logger.debug('Claude API SDK message received', {
          sessionId: request.sessionId,
          messageType: message.type,
          messageUuid: message.uuid
        });

        if (message.type === 'result') {
          if (message.subtype === 'success' && 'result' in message) {
            fullResponse = message.result;
            tokensUsed = message.usage['input_tokens'] + message.usage['output_tokens'];
            processingTime = message.duration_ms;
            
            logger.info('Claude API execution successful (pure LLM mode)', {
              sessionId: request.sessionId,
              responseLength: message.result.length,
              tokensUsed,
              processingTime,
              totalCost: message.total_cost_usd
            });
            break;
          } else if (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution') {
            logger.error('Claude API execution failed (pure LLM mode)', {
              sessionId: request.sessionId,
              subtype: message.subtype,
              isError: message.is_error
            });
            
            const errorMessage = `Claude API execution failed: ${message.subtype}`;
            throw new ClaudeCodeError(errorMessage);
          }
        } else if (message.type === 'assistant') {
          // Accumulate assistant messages as they come in
          if ('content' in message && Array.isArray(message.content)) {
            for (const content of message.content) {
              if (content.type === 'text') {
                fullResponse += content.text;
              }
            }
          }
        }
      }

      logger.info('Claude API SDK query completed (pure LLM mode)', {
        sessionId: request.sessionId,
        totalDuration: Date.now() - startTime,
        finalResponseLength: fullResponse.length,
        timestamp: new Date().toISOString()
      });

      return {
        response: fullResponse,
        sessionId: request.sessionId,
        metadata: {
          tokensUsed,
          processingTime: processingTime || (Date.now() - startTime)
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing Claude API request (pure LLM mode)', {
        error: errorMessage,
        sessionId: request.sessionId,
        promptLength: request.prompt?.length || 0,
        hasContext: !!request.context,
        timestamp: new Date().toISOString()
      });

      throw new ClaudeCodeError(`Claude API error: ${errorMessage}`);
    }
  }

  async *processStreamRequest(request: ClaudeCodeRequest): AsyncGenerator<ClaudeCodeStreamResponse, void, unknown> {
    try {
      this.validateSetup();

      logger.info('Processing Claude API stream request (pure LLM mode)', { 
        promptLength: request.prompt.length,
        hasContext: !!request.context,
        sessionId: request.sessionId 
      });

      // Build the query options for pure LLM mode
      // Use similar options to the working service but constrain via system prompt
      const publicDir = process.cwd() + '/public';
      const options: any = {
        cwd: publicDir,
        permissionMode: 'bypassPermissions',
        executable: 'node',
        executableArgs: []
      };
      
      // Set system prompt for pure LLM behavior - explicitly instruct not to use tools
      let systemPrompt = `You are Claude, an AI assistant created by Anthropic. You respond helpfully and accurately to user questions with text-only responses.

IMPORTANT CONSTRAINTS:
- You must NEVER use any tools, commands, or file operations
- You cannot create, read, write, or modify any files
- You cannot execute bash commands or run any code
- You cannot search the web or access external systems
- You cannot use any special functions or capabilities beyond text generation
- Respond ONLY with conversational text - no code execution, no file manipulation, no tool usage

If a user asks you to perform actions that would require tools, politely explain that you can only provide text-based responses and suggestions, but cannot perform the actual actions.`;

      if (request.context) {
        // If there's custom context, prepend our constraints to it
        systemPrompt = systemPrompt + '\n\nAdditional context: ' + request.context;
      }
      
      options.customSystemPrompt = systemPrompt;

      logger.debug('Claude API SDK streaming query options (pure LLM mode)', {
        sessionId: request.sessionId,
        options: JSON.stringify(options, null, 2),
        promptPreview: request.prompt.substring(0, 200) + (request.prompt.length > 200 ? '...' : '')
      });

      let fullResponse = '';
      
      logger.info('Starting Claude API SDK streaming query (pure LLM mode)', {
        sessionId: request.sessionId,
        timestamp: new Date().toISOString()
      });

      try {
        // Use Claude Code SDK query function in pure LLM streaming mode
        for await (const message of query({
          prompt: request.prompt,
          options
        })) {
          logger.debug('Claude API SDK streaming message received', {
            sessionId: request.sessionId,
            messageType: message.type,
            messageUuid: message.uuid
          });

          if (message.type === 'result') {
            if (message.subtype === 'success' && 'result' in message) {
              logger.info('Claude API streaming execution successful (pure LLM mode)', {
                sessionId: request.sessionId,
                responseLength: message.result.length,
                totalCost: message.total_cost_usd
              });

              // For streaming, we'll chunk the final result if we haven't streamed it already
              if (!fullResponse) {
                const chunks = this.chunkResponse(message.result);
                for (const chunk of chunks) {
                  yield {
                    type: 'content',
                    data: chunk,
                    sessionId: request.sessionId
                  };
                  // Add small delay to simulate streaming
                  await this.delay(50);
                }
              }
              fullResponse = message.result;
              break;
            } else if (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution') {
              logger.error('Claude API streaming execution failed (pure LLM mode)', {
                sessionId: request.sessionId,
                subtype: message.subtype,
                isError: message.is_error
              });

              yield {
                type: 'error',
                data: `Claude API execution failed: ${message.subtype}`,
                sessionId: request.sessionId
              };
              return;
            }
          } else if (message.type === 'assistant') {
            // Stream assistant messages as they come in
            if ('content' in message && Array.isArray(message.content)) {
              for (const content of message.content) {
                if (content.type === 'text') {
                  yield {
                    type: 'content',
                    data: content.text,
                    sessionId: request.sessionId
                  };
                  fullResponse += content.text;
                }
              }
            }
          }
        }

        logger.info('Claude API SDK streaming query completed (pure LLM mode)', {
          sessionId: request.sessionId,
          finalResponseLength: fullResponse.length,
          timestamp: new Date().toISOString()
        });

        yield {
          type: 'done',
          data: '',
          sessionId: request.sessionId
        };
      } catch (error) {
        logger.error('Error in Claude API streaming (pure LLM mode)', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId: request.sessionId
        });
        yield {
          type: 'error',
          data: error instanceof Error ? error.message : 'Unknown error',
          sessionId: request.sessionId
        };
      }
    } catch (error) {
      logger.error('Error processing Claude API stream request (pure LLM mode)', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: request.sessionId
      });
      yield {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
        sessionId: request.sessionId
      };
    }
  }

  private chunkResponse(response: string, chunkSize: number = 10): string[] {
    const words = response.split(' ');
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push(chunk + (i + chunkSize < words.length ? ' ' : ''));
    }
    
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new ClaudeApiService();