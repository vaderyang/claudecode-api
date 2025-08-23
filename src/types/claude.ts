export interface ClaudeCodeRequest {
  prompt: string;
  context: string | undefined;
  sessionId: string | undefined;
}

export interface FileContent {
  filename: string;
  content: string;
  size: number;
  operation: 'created' | 'updated';
}

export interface ClaudeCodeResponse {
  response: string;
  sessionId: string | undefined;
  metadata: {
    tokensUsed: number | undefined;
    processingTime: number | undefined;
  } | undefined;
  files?: FileContent[];
}

export interface ClaudeCodeStreamResponse {
  type: 'content' | 'error' | 'done' | 'files' | 'reasoning';
  data: string;
  sessionId: string | undefined;
  files?: FileContent[];
  reasoning?: {
    type: 'progress' | 'tool_use' | 'system_info';
    summary: string;
    details?: any;
  };
}
