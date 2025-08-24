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

import { v4 as uuidv4 } from 'uuid';
import { 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  ChatCompletionStreamResponse,
  ChatCompletionChoice,
  ChatCompletionStreamChoice
} from '../types/openai';
import { ClaudeCodeRequest, ClaudeCodeResponse } from '../types/claude';

export const transformOpenAIToClaude = (request: ChatCompletionRequest): ClaudeCodeRequest => {
  const messages = request.messages;
  let prompt = '';
  let context = '';

  messages.forEach((message) => {
    if (message.role === 'system') {
      context += `${message.content}\n`;
    } else if (message.role === 'user') {
      prompt += `User: ${message.content}\n`;
    } else if (message.role === 'assistant') {
      prompt += `Assistant: ${message.content}\n`;
    }
  });

  return {
    prompt: prompt.trim(),
    context: context.trim() || undefined as string | undefined,
    sessionId: undefined as string | undefined
  };
};

export const transformClaudeToOpenAI = (
  claudeResponse: ClaudeCodeResponse,
  request: ChatCompletionRequest,
  requestId: string = uuidv4()
): ChatCompletionResponse => {
  let content = claudeResponse.response;
  
  // Append file contents as code blocks if files exist
  if (claudeResponse.files && claudeResponse.files.length > 0) {
    const fileBlocks = claudeResponse.files.map(file => {
      const fileExtension = getFileExtension(file.filename);
      const language = getLanguageFromExtension(fileExtension);
      return `\n\n**${file.operation === 'created' ? 'Created' : 'Updated'} file: ${file.filename}**\n\n\`\`\`${language}\n${file.content}\n\`\`\``;
    }).join('');
    
    content += fileBlocks;
  }
  
  const choice: ChatCompletionChoice = {
    index: 0,
    message: {
      role: 'assistant',
      content: content
    },
    finish_reason: 'stop'
  };

  return {
    id: requestId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: request.model,
    choices: [choice],
    usage: {
      prompt_tokens: claudeResponse.metadata?.tokensUsed || 0,
      completion_tokens: Math.ceil(content.length / 4),
      total_tokens: (claudeResponse.metadata?.tokensUsed || 0) + Math.ceil(content.length / 4)
    }
  };
};

export const createStreamChunk = (
  content: string,
  requestId: string,
  model: string,
  isComplete: boolean = false
): ChatCompletionStreamResponse => {
  const choice: ChatCompletionStreamChoice = {
    index: 0,
    delta: isComplete ? {} : {
      content: content
    },
    finish_reason: isComplete ? 'stop' : null
  };

  return {
    id: requestId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [choice]
  };
};

export const formatSSE = (data: any): string => {
  return `data: ${JSON.stringify(data)}\n\n`;
};

export const createErrorChoice = (message: string): ChatCompletionChoice => {
  return {
    index: 0,
    message: {
      role: 'assistant',
      content: `Error: ${message}`
    },
    finish_reason: 'stop'
  };
};

/**
 * Extract file extension from filename
 */
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

/**
 * Map file extension to programming language for syntax highlighting
 */
const getLanguageFromExtension = (extension: string): string => {
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
};
