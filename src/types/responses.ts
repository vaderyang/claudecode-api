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

// OpenAI Responses API types for 2025
export interface ResponseRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  tools?: Array<{
    type: 'function' | 'code_interpreter' | 'file_search' | 'web_search';
    function?: {
      name: string;
      description?: string;
      parameters?: any;
    };
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  reasoning?: boolean;
  metadata?: {
    user_id?: string;
    session_id?: string;
  };
}

export interface ResponseObject {
  id: string;
  object: 'response';
  created: number;
  model: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  messages: Array<{
    id: string;
    object: 'message';
    created: number;
    role: 'assistant';
    content: Array<{
      type: 'text' | 'image' | 'tool_call';
      text?: {
        value: string;
      };
      tool_call?: {
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
          output?: string;
        };
      };
    }>;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata?: any;
}

export interface ResponseStreamEvent {
  id: string;
  object: 'response.delta';
  created: number;
  delta: {
    messages?: Array<{
      id?: string;
      role?: 'assistant';
      content?: Array<{
        type?: 'text';
        text?: {
          value?: string;
        };
      }>;
    }>;
    status?: 'in_progress' | 'completed' | 'failed';
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
}

export interface ResponsesList {
  object: 'list';
  data: ResponseObject[];
  first_id?: string;
  last_id?: string;
  has_more: boolean;
}