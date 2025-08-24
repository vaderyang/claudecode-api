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
import { ClaudeCodeRequest, ClaudeCodeResponse, ClaudeCodeStreamResponse, FileContent } from '../types/claude';
import { ClaudeCodeError } from '../utils/errors';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

class ClaudeCodeService {
  private sessions: Map<string, any> = new Map();
  private publicDir: string = process.cwd() + '/public';

  private validateSetup(): void {
    // Claude Code SDK handles its own authentication
    // No API key validation needed
    logger.debug('Claude Code service initialized - using built-in authentication');
  }

  async processRequest(request: ClaudeCodeRequest): Promise<ClaudeCodeResponse> {
    try {
      this.validateSetup();

      logger.info('Processing Claude Code request', { 
        promptLength: request.prompt.length,
        hasContext: !!request.context,
        sessionId: request.sessionId 
      });

      const startTime = Date.now();
      
      // Build the query options with public directory as working directory
      const publicDir = process.cwd() + '/public';
      const options: any = {
        cwd: publicDir,
        permissionMode: 'bypassPermissions'
      };
      
      if (request.context) {
        options.customSystemPrompt = request.context;
      }
      
      // Add instruction to use relative paths for file operations
      const contextAddition = '\n\nIMPORTANT: When creating files, use relative paths (e.g., "filename.html") as you are already in the public directory. You have write access to create files without asking for permission.';
      if (options.customSystemPrompt) {
        options.customSystemPrompt += contextAddition;
      } else {
        options.customSystemPrompt = 'You are a helpful coding assistant that can create and modify files.' + contextAddition;
      }

      logger.debug('Claude Code SDK query options', {
        sessionId: request.sessionId,
        options: JSON.stringify(options, null, 2),
        promptPreview: request.prompt.substring(0, 200) + (request.prompt.length > 200 ? '...' : '')
      });

      let fullResponse = '';
      let tokensUsed = 0;
      let processingTime = 0;
      const messages: any[] = [];
      
      // Take a snapshot before processing to detect file operations
      const beforeSnapshot = this.createFileSnapshot();

      logger.info('Starting Claude Code SDK query', {
        sessionId: request.sessionId,
        timestamp: new Date().toISOString()
      });

      // Use Claude Code SDK query function
      for await (const message of query({
        prompt: request.prompt,
        options
      })) {
        // Collect all messages for file operation detection
        messages.push(message);
        
        logger.debug('Claude Code SDK message received', {
          sessionId: request.sessionId,
          messageType: message.type,
          messageUuid: message.uuid,
          messageDetails: JSON.stringify(message, null, 2)
        });

        if (message.type === 'result') {
          logger.info('Claude Code result message', {
            sessionId: request.sessionId,
            subtype: message.subtype,
            isError: message.is_error,
            numTurns: message.num_turns,
            durationMs: message.duration_ms,
            durationApiMs: message.duration_api_ms,
            totalCostUsd: message.total_cost_usd,
            usage: message.usage,
            permissionDenials: message.permission_denials?.length || 0
          });

          if (message.subtype === 'success' && 'result' in message) {
            fullResponse = message.result;
            tokensUsed = message.usage['input_tokens'] + message.usage['output_tokens'];
            processingTime = message.duration_ms;
            
            logger.info('Claude Code execution successful', {
              sessionId: request.sessionId,
              responseLength: message.result.length,
              tokensUsed,
              processingTime,
              totalCost: message.total_cost_usd
            });
            break;
          } else if (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution') {
            logger.error('Claude Code execution failed', {
              sessionId: request.sessionId,
              subtype: message.subtype,
              isError: message.is_error,
              numTurns: message.num_turns,
              permissionDenials: message.permission_denials
            });
            throw new ClaudeCodeError(`Claude Code execution failed: ${message.subtype}`);
          }
        } else if (message.type === 'assistant') {
          logger.debug('Claude Code assistant message', {
            sessionId: request.sessionId,
            messageId: message.uuid,
            contentLength: 'content' in message && Array.isArray(message.content) ? message.content.length : 0
          });

          // Accumulate assistant messages as they come in
          if ('content' in message && Array.isArray(message.content)) {
            for (const content of message.content) {
              if (content.type === 'text') {
                logger.debug('Assistant text content', {
                  sessionId: request.sessionId,
                  textLength: content.text.length,
                  textPreview: content.text.substring(0, 100) + (content.text.length > 100 ? '...' : '')
                });
                fullResponse += content.text;
              }
            }
          }
        } else if (message.type === 'system') {
          logger.info('Claude Code system message', {
            sessionId: request.sessionId,
            subtype: 'subtype' in message ? message.subtype : 'unknown',
            apiKeySource: 'apiKeySource' in message ? message.apiKeySource : undefined,
            cwd: 'cwd' in message ? message.cwd : undefined,
            tools: 'tools' in message ? message.tools : undefined,
            mcpServers: 'mcp_servers' in message ? message.mcp_servers?.length : 0
          });
        } else if (message.type === 'user') {
          logger.debug('Claude Code user message', {
            sessionId: request.sessionId,
            messageId: message.uuid,
            contentLength: 'content' in message && Array.isArray(message.content) ? message.content.length : 0
          });
        }
      }

      logger.info('Claude Code SDK query completed', {
        sessionId: request.sessionId,
        totalDuration: Date.now() - startTime,
        finalResponseLength: fullResponse.length,
        timestamp: new Date().toISOString()
      });
      
      // Detect file operations and read file contents
      logger.info('Starting file operation detection', {
        sessionId: request.sessionId,
        messageCount: messages.length
      });
      
      const modifiedFiles = this.detectFileOperations(messages);
      let fileContents: FileContent[] = [];
      
      logger.info('File operation detection complete', {
        sessionId: request.sessionId,
        modifiedFileCount: modifiedFiles.size,
        modifiedFiles: Array.from(modifiedFiles)
      });
      
      if (modifiedFiles.size > 0) {
        logger.info('Detected file operations', {
          sessionId: request.sessionId,
          fileCount: modifiedFiles.size,
          files: Array.from(modifiedFiles)
        });
        
        fileContents = await this.getFileContents(modifiedFiles, beforeSnapshot);
        
        logger.info('Read file contents', {
          sessionId: request.sessionId,
          contentCount: fileContents.length,
          totalSize: fileContents.reduce((sum, file) => sum + file.size, 0)
        });
      } else {
        logger.info('No file operations detected - checking if we can detect files differently', {
          sessionId: request.sessionId
        });
        
        // Try to detect files by checking the public directory for new/changed files
        const afterSnapshot = this.createFileSnapshot();
        const changedFiles = new Set<string>();
        
        // Check for new files or changed files
        for (const [relativePath, afterStats] of afterSnapshot) {
          const before = beforeSnapshot.get(relativePath);
          if (!before || before.size !== afterStats.size || before.mtime < afterStats.mtime) {
            changedFiles.add(relativePath);
          }
        }
        
        if (changedFiles.size > 0) {
          logger.info('Detected changed files by directory comparison', {
            sessionId: request.sessionId,
            changedFileCount: changedFiles.size,
            changedFiles: Array.from(changedFiles)
          });
          
          fileContents = await this.getFileContents(changedFiles, beforeSnapshot);
          
          logger.info('Read contents of changed files', {
            sessionId: request.sessionId,
            contentCount: fileContents.length,
            totalSize: fileContents.reduce((sum, file) => sum + file.size, 0)
          });
        }
      }

      const response: ClaudeCodeResponse = {
        response: fullResponse,
        sessionId: request.sessionId,
        metadata: {
          tokensUsed,
          processingTime: processingTime || (Date.now() - startTime)
        }
      };
      
      // Add files only if they exist
      if (fileContents.length > 0) {
        response.files = fileContents;
      }
      
      if (request.sessionId) {
        this.sessions.set(request.sessionId, {
          lastRequest: request,
          lastResponse: response,
          timestamp: new Date()
        });
      }

      return response;
    } catch (error) {
      logger.error('Error processing Claude Code request', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: request.sessionId
      });
      throw new ClaudeCodeError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async *processStreamRequest(request: ClaudeCodeRequest, enableReasoning: boolean = false): AsyncGenerator<ClaudeCodeStreamResponse, void, unknown> {
    try {
      this.validateSetup();

      logger.info('Processing Claude Code stream request', { 
        promptLength: request.prompt.length,
        hasContext: !!request.context,
        sessionId: request.sessionId 
      });

      // Build the query options with public directory as working directory
      const publicDir = process.cwd() + '/public';
      const options: any = {
        cwd: publicDir,
        permissionMode: 'bypassPermissions'
      };
      
      if (request.context) {
        options.customSystemPrompt = request.context;
      }
      
      // Add instruction to use relative paths for file operations
      const contextAddition = '\n\nIMPORTANT: When creating files, use relative paths (e.g., "filename.html") as you are already in the public directory. You have write access to create files without asking for permission.';
      if (options.customSystemPrompt) {
        options.customSystemPrompt += contextAddition;
      } else {
        options.customSystemPrompt = 'You are a helpful coding assistant that can create and modify files.' + contextAddition;
      }

      logger.debug('Claude Code SDK streaming query options', {
        sessionId: request.sessionId,
        options: JSON.stringify(options, null, 2),
        promptPreview: request.prompt.substring(0, 200) + (request.prompt.length > 200 ? '...' : '')
      });

      let fullResponse = '';
      const messages: any[] = [];
      
      // Take a snapshot before processing to detect file operations
      const beforeSnapshot = this.createFileSnapshot();
      
      logger.info('Starting Claude Code SDK streaming query', {
        sessionId: request.sessionId,
        timestamp: new Date().toISOString()
      });

      try {
        // Use Claude Code SDK query function
        for await (const message of query({
          prompt: request.prompt,
          options
        })) {
          // Collect all messages for file operation detection
          messages.push(message);
          
          logger.debug('Claude Code SDK streaming message received', {
            sessionId: request.sessionId,
            messageType: message.type,
            messageUuid: message.uuid,
            messageDetails: JSON.stringify(message, null, 2)
          });

          if (message.type === 'result') {
            logger.info('Claude Code streaming result message', {
              sessionId: request.sessionId,
              subtype: message.subtype,
              isError: message.is_error,
              numTurns: message.num_turns,
              durationMs: message.duration_ms,
              durationApiMs: message.duration_api_ms,
              totalCostUsd: message.total_cost_usd,
              usage: message.usage,
              permissionDenials: message.permission_denials?.length || 0
            });

            if (message.subtype === 'success' && 'result' in message) {
              logger.info('Claude Code streaming execution successful', {
                sessionId: request.sessionId,
                responseLength: message.result.length,
                totalCost: message.total_cost_usd
              });

              // For streaming, we'll chunk the final result
              const chunks = this.chunkResponse(message.result);
              for (const chunk of chunks) {
                logger.debug('Streaming chunk', {
                  sessionId: request.sessionId,
                  chunkLength: chunk.length,
                  chunkPreview: chunk.substring(0, 50) + (chunk.length > 50 ? '...' : '')
                });

                yield {
                  type: 'content',
                  data: chunk,
                  sessionId: request.sessionId
                };
                // Add small delay to simulate streaming
                await this.delay(50);
              }
              fullResponse = message.result;
              break;
            } else if (message.subtype === 'error_max_turns' || message.subtype === 'error_during_execution') {
              logger.error('Claude Code streaming execution failed', {
                sessionId: request.sessionId,
                subtype: message.subtype,
                isError: message.is_error,
                numTurns: message.num_turns,
                permissionDenials: message.permission_denials
              });

              yield {
                type: 'error',
                data: `Claude Code execution failed: ${message.subtype}`,
                sessionId: request.sessionId
              };
              return;
            }
          } else if (message.type === 'assistant') {
            logger.debug('Claude Code streaming assistant message', {
              sessionId: request.sessionId,
              messageId: message.uuid,
              contentLength: 'content' in message && Array.isArray(message.content) ? message.content.length : 0
            });

            // Stream assistant messages as they come in
            if ('content' in message && Array.isArray(message.content)) {
              for (const content of message.content) {
                if (content.type === 'text') {
                  logger.debug('Streaming assistant text content', {
                    sessionId: request.sessionId,
                    textLength: content.text.length,
                    textPreview: content.text.substring(0, 100) + (content.text.length > 100 ? '...' : '')
                  });

                  yield {
                    type: 'content',
                    data: content.text,
                    sessionId: request.sessionId
                  };
                  fullResponse += content.text;
                } else if (content.type === 'tool_use' && enableReasoning) {
                  // Yield reasoning information for tool usage
                  const toolName = content.name;
                  const reasoningSummary = this.extractReasoningFromToolUse(toolName, content.input);
                  if (reasoningSummary) {
                    yield {
                      type: 'reasoning',
                      data: '',
                      sessionId: request.sessionId,
                      reasoning: {
                        type: 'tool_use',
                        summary: reasoningSummary,
                        details: {
                          toolName: toolName,
                          toolId: content.id,
                          inputKeys: Object.keys(content.input || {})
                        }
                      }
                    };
                  }
                }
              }
            }
          } else if (message.type === 'system') {
            logger.info('Claude Code streaming system message', {
              sessionId: request.sessionId,
              subtype: 'subtype' in message ? message.subtype : 'unknown',
              apiKeySource: 'apiKeySource' in message ? message.apiKeySource : undefined,
              cwd: 'cwd' in message ? message.cwd : undefined,
              tools: 'tools' in message ? message.tools : undefined,
              mcpServers: 'mcp_servers' in message ? message.mcp_servers?.length : 0
            });
            
            // Yield reasoning information if enabled
            if (enableReasoning) {
              const reasoningSummary = this.extractReasoningFromSystemMessage(message);
              if (reasoningSummary) {
                yield {
                  type: 'reasoning',
                  data: '',
                  sessionId: request.sessionId,
                  reasoning: {
                    type: 'system_info',
                    summary: reasoningSummary,
                    details: {
                      subtype: 'subtype' in message ? message.subtype : 'unknown',
                      tools: 'tools' in message ? message.tools : undefined,
                      mcpServers: 'mcp_servers' in message ? message.mcp_servers?.length : 0
                    }
                  }
                };
              }
            }
          } else if (message.type === 'user') {
            logger.debug('Claude Code streaming user message', {
              sessionId: request.sessionId,
              messageId: message.uuid,
              contentLength: 'content' in message && Array.isArray(message.content) ? message.content.length : 0
            });
            
            // Yield reasoning information if enabled
            if (enableReasoning) {
              yield {
                type: 'reasoning',
                data: '',
                sessionId: request.sessionId,
                reasoning: {
                  type: 'progress',
                  summary: 'Processing user request...',
                  details: {
                    messageId: message.uuid,
                    contentLength: 'content' in message && Array.isArray(message.content) ? message.content.length : 0
                  }
                }
              };
            }
          }
        }

        logger.info('Claude Code SDK streaming query completed', {
          sessionId: request.sessionId,
          finalResponseLength: fullResponse.length,
          timestamp: new Date().toISOString()
        });
        
        // Detect file operations and stream file contents
        const modifiedFiles = this.detectFileOperations(messages);
        let fileContents: FileContent[] = [];
        
        if (modifiedFiles.size > 0) {
          logger.info('Detected file operations in streaming', {
            sessionId: request.sessionId,
            fileCount: modifiedFiles.size,
            files: Array.from(modifiedFiles)
          });
          
          fileContents = await this.getFileContents(modifiedFiles, beforeSnapshot);
          
          logger.info('Read file contents in streaming', {
            sessionId: request.sessionId,
            contentCount: fileContents.length,
            totalSize: fileContents.reduce((sum, file) => sum + file.size, 0)
          });
          
          // Stream file contents as code blocks
          if (fileContents.length > 0) {
            const fileBlocks = fileContents.map(file => {
              const fileExtension = this.getFileExtension(file.filename);
              const language = this.getLanguageFromExtension(fileExtension);
              return `\n\n**${file.operation === 'created' ? 'Created' : 'Updated'} file: ${file.filename}**\n\n\`\`\`${language}\n${file.content}\n\`\`\``;
            }).join('');
            
            // Stream the file blocks as content
            yield {
              type: 'content',
              data: fileBlocks,
              sessionId: request.sessionId
            };
          }
        } else {
          logger.info('No file operations detected in streaming - checking directory comparison', {
            sessionId: request.sessionId
          });
          
          // Try to detect files by checking the public directory for new/changed files
          const afterSnapshot = this.createFileSnapshot();
          const changedFiles = new Set<string>();
          
          // Check for new files or changed files
          for (const [relativePath, afterStats] of afterSnapshot) {
            const before = beforeSnapshot.get(relativePath);
            if (!before || before.size !== afterStats.size || before.mtime < afterStats.mtime) {
              changedFiles.add(relativePath);
            }
          }
          
          if (changedFiles.size > 0) {
            logger.info('Detected changed files by directory comparison in streaming', {
              sessionId: request.sessionId,
              changedFileCount: changedFiles.size,
              changedFiles: Array.from(changedFiles)
            });
            
            fileContents = await this.getFileContents(changedFiles, beforeSnapshot);
            
            logger.info('Read contents of changed files in streaming', {
              sessionId: request.sessionId,
              contentCount: fileContents.length,
              totalSize: fileContents.reduce((sum, file) => sum + file.size, 0)
            });
            
            // Stream the file blocks as content
            if (fileContents.length > 0) {
              const fileBlocks = fileContents.map(file => {
                const fileExtension = this.getFileExtension(file.filename);
                const language = this.getLanguageFromExtension(fileExtension);
                return `\n\n**${file.operation === 'created' ? 'Created' : 'Updated'} file: ${file.filename}**\n\n\`\`\`${language}\n${file.content}\n\`\`\``;
              }).join('');
              
              // Stream the file blocks as content
              yield {
                type: 'content',
                data: fileBlocks,
                sessionId: request.sessionId
              };
            }
          }
        }

        yield {
          type: 'done',
          data: '',
          sessionId: request.sessionId
        };

        if (request.sessionId && fullResponse) {
          const response: ClaudeCodeResponse = {
            response: fullResponse,
            sessionId: request.sessionId,
            metadata: {
              tokensUsed: Math.floor(fullResponse.length / 3),
              processingTime: undefined
            }
          };

          this.sessions.set(request.sessionId, {
            lastRequest: request,
            lastResponse: response,
            timestamp: new Date()
          });
        }
      } catch (error) {
        logger.error('Error in Claude Code streaming', { 
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
      logger.error('Error processing Claude Code stream request', { 
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

  /**
   * Detects file operations (create/update) from Claude Code SDK messages
   */
  private detectFileOperations(messages: any[]): Set<string> {
    const modifiedFiles = new Set<string>();
    
    for (const message of messages) {
      // Look for tool use messages that indicate file operations
      if (message.type === 'assistant' && 'content' in message && Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'tool_use') {
            const toolName = content.name;
            const toolInput = content.input;
            
            // Check for file creation tools
            if (toolName === 'create_file' && toolInput?.file_path) {
              // Convert absolute path to relative path within public directory
              const relativePath = this.getRelativePath(toolInput.file_path);
              if (relativePath) {
                modifiedFiles.add(relativePath);
              }
            }
            
            // Check for file editing tools
            if (toolName === 'edit_files' && toolInput?.diffs) {
              for (const diff of toolInput.diffs) {
                if (diff.file_path) {
                  const relativePath = this.getRelativePath(diff.file_path);
                  if (relativePath) {
                    modifiedFiles.add(relativePath);
                  }
                }
              }
            }
          }
        }
      }
      
      // Look for tool result messages that confirm successful operations
      if (message.type === 'tool_result' && message.tool_use_id) {
        // We could add additional validation here if needed
      }
    }
    
    return modifiedFiles;
  }
  
  /**
   * Converts absolute file path to relative path within public directory
   */
  private getRelativePath(filePath: string): string | null {
    // If it's already a relative path, assume it's within public directory
    if (!path.isAbsolute(filePath)) {
      return filePath;
    }
    
    // Check if the absolute path is within our public directory
    if (filePath.startsWith(this.publicDir)) {
      return path.relative(this.publicDir, filePath);
    }
    
    return null;
  }
  
  /**
   * Reads file contents for modified files and determines operation type
   */
  private async getFileContents(modifiedFiles: Set<string>, beforeSnapshot?: Map<string, { exists: boolean; size: number; mtime: Date }>): Promise<FileContent[]> {
    const fileContents: FileContent[] = [];
    
    for (const relativePath of modifiedFiles) {
      try {
        const fullPath = path.join(this.publicDir, relativePath);
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          logger.warn(`File not found after operation: ${relativePath}`);
          continue;
        }
        
        const stats = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        
        // Determine operation type based on before snapshot
        let operationType: 'created' | 'updated' = 'created';
        if (beforeSnapshot && beforeSnapshot.has(relativePath)) {
          const before = beforeSnapshot.get(relativePath)!;
          operationType = before.exists ? 'updated' : 'created';
        }
        
        fileContents.push({
          filename: relativePath,
          content: content,
          size: stats.size,
          operation: operationType
        });
        
        logger.debug(`Read file content for ${operationType} operation`, {
          filename: relativePath,
          size: stats.size,
          contentLength: content.length
        });
        
      } catch (error) {
        logger.error(`Failed to read file content: ${relativePath}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return fileContents;
  }
  
  /**
   * Creates a snapshot of current file states in the public directory
   */
  private createFileSnapshot(): Map<string, { exists: boolean; size: number; mtime: Date }> {
    const snapshot = new Map<string, { exists: boolean; size: number; mtime: Date }>();
    
    try {
      if (!fs.existsSync(this.publicDir)) {
        return snapshot;
      }
      
      // Use simpler approach to walk directory tree
      this.walkDirectory(this.publicDir, this.publicDir, snapshot);
    } catch (error) {
      logger.error('Failed to create file snapshot', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return snapshot;
  }
  
  private walkDirectory(dir: string, baseDir: string, snapshot: Map<string, { exists: boolean; size: number; mtime: Date }>) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile()) {
          const relativePath = path.relative(baseDir, fullPath);
          
          try {
            const stats = fs.statSync(fullPath);
            snapshot.set(relativePath, {
              exists: true,
              size: stats.size,
              mtime: stats.mtime
            });
          } catch (error) {
            // File might have been deleted between readdir and stat
            logger.debug(`Could not stat file during snapshot: ${relativePath}`);
          }
        } else if (entry.isDirectory()) {
          // Recursively walk subdirectories
          this.walkDirectory(fullPath, baseDir, snapshot);
        }
      }
    } catch (error) {
      logger.debug('Could not read directory during snapshot', {
        dir,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getSession(sessionId: string): any | undefined {
    return this.sessions.get(sessionId);
  }

  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clearAllSessions(): void {
    this.sessions.clear();
  }
  
  /**
   * Extract file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  }

  /**
   * Extracts reasoning summary from system messages
   */
  private extractReasoningFromSystemMessage(message: any): string | null {
    if (!message || typeof message !== 'object') {
      return null;
    }

    const subtype = 'subtype' in message ? message.subtype : 'unknown';
    const tools = 'tools' in message ? message.tools : undefined;
    const mcpServers = 'mcp_servers' in message ? message.mcp_servers?.length : 0;
    
    // Create a reasoning summary based on system message content
    if (subtype === 'system_setup' || subtype === 'system_init') {
      const toolsInfo = tools ? `with ${Array.isArray(tools) ? tools.length : 'unknown'} tools` : 'without tools';
      const mcpInfo = mcpServers > 0 ? ` and ${mcpServers} MCP servers` : '';
      return `Setting up system environment ${toolsInfo}${mcpInfo}...`;
    } else if (subtype === 'session_start') {
      return 'Starting new session and initializing workspace...';
    } else if (tools && Array.isArray(tools) && tools.length > 0) {
      return `Configuring available tools: ${tools.map(tool => tool.name || tool.type).join(', ')}...`;
    } else {
      return `Processing system configuration (${subtype})...`;
    }
  }

  /**
   * Extracts reasoning summary from tool use messages
   */
  private extractReasoningFromToolUse(toolName: string, toolInput: any): string | null {
    if (!toolName) {
      return null;
    }

    switch (toolName) {
      case 'create_file':
        const fileName = toolInput?.file_path || toolInput?.filename || 'unknown file';
        return `Creating new file: ${fileName}...`;
      
      case 'edit_files':
        const fileCount = toolInput?.diffs?.length || 1;
        const firstFile = toolInput?.diffs?.[0]?.file_path || 'files';
        return fileCount === 1 
          ? `Editing file: ${firstFile}...`
          : `Editing ${fileCount} files starting with ${firstFile}...`;
      
      case 'read_files':
        const readFileCount = toolInput?.files?.length || 1;
        return `Reading ${readFileCount} file${readFileCount === 1 ? '' : 's'}...`;
      
      case 'run_command':
        const command = toolInput?.command || 'command';
        const shortCommand = command.length > 40 ? command.substring(0, 40) + '...' : command;
        return `Executing command: ${shortCommand}`;
      
      case 'search_codebase':
        const query = toolInput?.query || 'codebase';
        return `Searching codebase for: ${query}...`;
      
      case 'grep':
        const searchTerms = toolInput?.queries?.join(', ') || 'text';
        return `Searching for: ${searchTerms}...`;
      
      default:
        return `Using tool: ${toolName}...`;
    }
  }

  /**
   * Map file extension to programming language for syntax highlighting
   */
  private getLanguageFromExtension(extension: string): string {
    const extensionMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'htm': 'html',
      'xml': 'xml',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'zsh',
      'fish': 'fish',
      'ps1': 'powershell',
      'bat': 'batch',
      'cmd': 'batch',
      'dockerfile': 'dockerfile',
      'md': 'markdown',
      'markdown': 'markdown',
      'txt': 'text',
      'log': 'text',
      'csv': 'csv',
      'r': 'r',
      'R': 'r',
      'matlab': 'matlab',
      'm': 'matlab',
      'pl': 'perl',
      'lua': 'lua',
      'vim': 'vim',
      'make': 'makefile',
      'makefile': 'makefile',
      'gradle': 'gradle',
      'pom': 'xml'
    };

    return extensionMap[extension] || 'text';
  }
}

export default new ClaudeCodeService();