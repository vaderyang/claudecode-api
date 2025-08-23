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