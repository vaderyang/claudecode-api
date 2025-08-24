# Claude Code SDK Integration Guide

## Overview

This document provides comprehensive information about the Claude Code SDK integration within the API service. The Claude Code SDK provides powerful agentic coding capabilities that enable autonomous development tasks, file operations, and intelligent code generation.

## What is Claude Code SDK?

The Claude Code SDK (`@anthropic-ai/claude-code`) is an official package from Anthropic that provides agentic coding capabilities. It allows Claude to:

- **Understand and navigate codebases**
- **Create, read, and modify files**
- **Execute terminal commands**
- **Analyze project structures**
- **Perform complex development tasks autonomously**

## Installation and Setup

### Package Installation

The SDK is already installed as part of this project:

```json
{
  "dependencies": {
    "@anthropic-ai/claude-code": "^1.0.89"
  }
}
```

### Authentication

The Claude Code SDK handles its own authentication internally. **No API keys are required** - the SDK manages authentication automatically through Anthropic's infrastructure.

```typescript
// No authentication configuration needed
import { query } from '@anthropic-ai/claude-code';
```

## SDK Architecture

### Core Function: `query()`

The primary interface to the Claude Code SDK is the `query()` function:

```typescript
import { query } from '@anthropic-ai/claude-code';

for await (const message of query({
  prompt: "Create a React component for a todo list",
  options: {
    cwd: "/path/to/project",
    permissionMode: "bypassPermissions"
  }
})) {
  console.log(message);
}
```

### Message Types

The SDK returns different message types through an async generator:

#### System Messages
```typescript
{
  type: 'system',
  subtype: 'system_setup' | 'session_start',
  apiKeySource?: string,
  cwd?: string,
  tools?: Array<any>,
  mcp_servers?: Array<any>
}
```

#### Assistant Messages
```typescript
{
  type: 'assistant',
  uuid: string,
  content: Array<{
    type: 'text' | 'tool_use',
    text?: string,
    name?: string,
    input?: any,
    id?: string
  }>
}
```

#### User Messages
```typescript
{
  type: 'user',
  uuid: string,
  content: Array<{
    type: 'text',
    text: string
  }>
}
```

#### Result Messages
```typescript
{
  type: 'result',
  subtype: 'success' | 'error_max_turns' | 'error_during_execution',
  is_error: boolean,
  result?: string,
  num_turns: number,
  duration_ms: number,
  duration_api_ms: number,
  total_cost_usd: number,
  usage: {
    input_tokens: number,
    output_tokens: number
  },
  permission_denials?: Array<any>
}
```

## Integration Implementation

### Service Layer Integration

The Claude Code SDK is integrated through the `ClaudeCodeService` class:

```typescript
import { query } from '@anthropic-ai/claude-code';
import { ClaudeCodeRequest, ClaudeCodeResponse } from '../types/claude';

class ClaudeCodeService {
  async processRequest(request: ClaudeCodeRequest): Promise<ClaudeCodeResponse> {
    const options = {
      cwd: process.cwd() + '/public',
      permissionMode: 'bypassPermissions'
    };

    let fullResponse = '';
    const messages: any[] = [];

    for await (const message of query({
      prompt: request.prompt,
      options
    })) {
      messages.push(message);
      
      if (message.type === 'result' && message.subtype === 'success') {
        fullResponse = message.result;
        break;
      }
    }

    return {
      response: fullResponse,
      sessionId: request.sessionId,
      metadata: { /* ... */ }
    };
  }
}
```

### Request Transformation

OpenAI format requests are transformed to Claude Code format:

```typescript
export const transformOpenAIToClaude = (request: ChatCompletionRequest): ClaudeCodeRequest => {
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

  return {
    prompt: prompt.trim(),
    context: context.trim() || undefined,
    sessionId: undefined
  };
};
```

### Response Transformation

Claude Code responses are transformed back to OpenAI format:

```typescript
export const transformClaudeToOpenAI = (
  claudeResponse: ClaudeCodeResponse,
  request: ChatCompletionRequest,
  requestId: string
): ChatCompletionResponse => {
  let content = claudeResponse.response;
  
  // Append file contents as code blocks
  if (claudeResponse.files && claudeResponse.files.length > 0) {
    const fileBlocks = claudeResponse.files.map(file => {
      const language = getLanguageFromExtension(file.filename);
      return `\n\n**${file.operation === 'created' ? 'Created' : 'Updated'} file: ${file.filename}**\n\n\`\`\`${language}\n${file.content}\n\`\`\``;
    }).join('');
    
    content += fileBlocks;
  }

  return {
    id: requestId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: request.model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: claudeResponse.metadata?.tokensUsed || 0,
      completion_tokens: Math.ceil(content.length / 4),
      total_tokens: (claudeResponse.metadata?.tokensUsed || 0) + Math.ceil(content.length / 4)
    }
  };
};
```

## SDK Configuration Options

### Working Directory

The SDK operates within a specified working directory:

```typescript
const options = {
  cwd: process.cwd() + '/public',  // Set working directory
  permissionMode: 'bypassPermissions'
};
```

### Permission Modes

- **`bypassPermissions`**: Allows full file system access without prompts
- **`default`**: Requests permission for sensitive operations

### Custom System Prompts

You can provide custom system instructions:

```typescript
const options = {
  cwd: '/project/path',
  permissionMode: 'bypassPermissions',
  customSystemPrompt: 'You are a senior software engineer. Follow best practices and include comprehensive error handling.'
};
```

## File Operations

### Automatic File Detection

The service automatically detects file operations from SDK messages:

```typescript
private detectFileOperations(messages: any[]): Set<string> {
  const modifiedFiles = new Set<string>();
  
  for (const message of messages) {
    if (message.type === 'assistant' && message.content) {
      for (const content of message.content) {
        if (content.type === 'tool_use') {
          if (content.name === 'create_file' && content.input?.file_path) {
            modifiedFiles.add(content.input.file_path);
          }
          if (content.name === 'edit_files' && content.input?.diffs) {
            for (const diff of content.input.diffs) {
              if (diff.file_path) {
                modifiedFiles.add(diff.file_path);
              }
            }
          }
        }
      }
    }
  }
  
  return modifiedFiles;
}
```

### File Content Inclusion

Modified files are automatically read and included in responses:

```typescript
private async getFileContents(modifiedFiles: Set<string>): Promise<FileContent[]> {
  const fileContents: FileContent[] = [];
  
  for (const relativePath of modifiedFiles) {
    try {
      const fullPath = path.join(this.publicDir, relativePath);
      const stats = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      fileContents.push({
        filename: relativePath,
        content: content,
        size: stats.size,
        operation: 'created' // or 'updated'
      });
    } catch (error) {
      // Handle file read errors
    }
  }
  
  return fileContents;
}
```

## Streaming Support

### Streaming Implementation

The SDK supports streaming responses for real-time feedback:

```typescript
async *processStreamRequest(request: ClaudeCodeRequest): AsyncGenerator<ClaudeCodeStreamResponse> {
  for await (const message of query({
    prompt: request.prompt,
    options: this.buildOptions(request)
  })) {
    if (message.type === 'assistant' && message.content) {
      for (const content of message.content) {
        if (content.type === 'text') {
          yield {
            type: 'content',
            data: content.text,
            sessionId: request.sessionId
          };
        }
      }
    }
  }
}
```

### Reasoning Integration

The service provides reasoning insights during streaming:

```typescript
if (enableReasoning && message.type === 'system') {
  const reasoningSummary = this.extractReasoningFromSystemMessage(message);
  if (reasoningSummary) {
    yield {
      type: 'reasoning',
      data: '',
      sessionId: request.sessionId,
      reasoning: {
        type: 'system_info',
        summary: reasoningSummary,
        details: { /* ... */ }
      }
    };
  }
}
```

## Available Tools

The Claude Code SDK provides access to various development tools:

### File Operations
- **`create_file`**: Create new files
- **`edit_files`**: Modify existing files
- **`read_files`**: Read file contents

### Command Execution  
- **`run_command`**: Execute terminal commands
- **`search_codebase`**: Search through code
- **`grep`**: Text pattern matching

### Analysis Tools
- **Project structure analysis**
- **Dependency detection**
- **Code quality assessment**

## Error Handling

### SDK Error Types

The SDK can return different error types:

```typescript
if (message.type === 'result') {
  if (message.subtype === 'error_max_turns') {
    throw new ClaudeCodeError('Maximum turns exceeded');
  }
  if (message.subtype === 'error_during_execution') {
    throw new ClaudeCodeError('Execution error occurred');
  }
}
```

### Authentication Error Detection

The authentication manager detects SDK authentication issues:

```typescript
public isAuthenticationError(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || '';
  
  const authErrorPatterns = [
    'authentication', 'auth', 'unauthorized', 'invalid.*key',
    'token.*expired', 'session.*expired', 'permission.*denied',
    'access.*denied', 'forbidden', '401', '403'
  ];

  return authErrorPatterns.some(pattern => {
    const regex = new RegExp(pattern);
    return regex.test(errorMessage);
  });
}
```

## Performance Considerations

### Message Processing

The SDK processes messages asynchronously, allowing for efficient streaming:

```typescript
// Collect messages for analysis
const messages: any[] = [];
for await (const message of query(queryParams)) {
  messages.push(message);
  
  // Process message immediately for streaming
  if (message.type === 'assistant') {
    // Stream content immediately
    yield processMessage(message);
  }
}

// Post-process for file operations
const fileOperations = this.detectFileOperations(messages);
```

### Memory Management

The service manages memory by processing messages as they arrive:

```typescript
// Don't accumulate all messages in memory
for await (const message of query(queryParams)) {
  // Process immediately
  await processMessage(message);
  
  // Only keep essential data
  if (message.type === 'result') {
    break; // Exit early when complete
  }
}
```

## Monitoring and Debugging

### Comprehensive Logging

The service provides detailed logging of SDK interactions:

```typescript
logger.debug('Claude Code SDK message received', {
  sessionId: request.sessionId,
  messageType: message.type,
  messageUuid: message.uuid,
  messageDetails: JSON.stringify(message, null, 2)
});
```

### Performance Metrics

Key metrics are tracked for monitoring:

```typescript
logger.info('Claude Code execution successful', {
  sessionId: request.sessionId,
  responseLength: message.result.length,
  tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
  processingTime: message.duration_ms,
  totalCost: message.total_cost_usd
});
```

## Best Practices

### 1. Working Directory Management

Always set an appropriate working directory:

```typescript
const options = {
  cwd: path.join(process.cwd(), 'workspace'),
  permissionMode: 'bypassPermissions'
};
```

### 2. Error Handling

Implement comprehensive error handling:

```typescript
try {
  for await (const message of query(queryParams)) {
    // Process message
  }
} catch (error) {
  if (authManager.isAuthenticationError(error)) {
    // Handle authentication error
    await authManager.refreshAuthentication();
  } else {
    // Handle other errors
    throw new ClaudeCodeError(error.message);
  }
}
```

### 3. Resource Management

Clean up resources and manage memory:

```typescript
// Use generators for streaming
async function* processMessages() {
  try {
    for await (const message of query(queryParams)) {
      yield processMessage(message);
    }
  } finally {
    // Cleanup resources
    cleanupResources();
  }
}
```

### 4. System Prompts

Provide clear, specific system prompts:

```typescript
const contextAddition = `
IMPORTANT: When creating files, use relative paths as you are already in the project directory. 
You have write access to create files without asking for permission.
Follow the project's existing code style and patterns.
`;
```

## Limitations and Considerations

### Current Limitations

1. **File Size**: Large files may impact performance
2. **Command Execution**: Some commands may have security restrictions
3. **Network Access**: Limited network operations
4. **Binary Files**: Text-based operations only

### Security Considerations

1. **Permission Mode**: Use `bypassPermissions` carefully
2. **Working Directory**: Restrict to safe directories
3. **Command Execution**: Monitor executed commands
4. **File Access**: Limit file system access scope

## Troubleshooting

### Common Issues

**SDK Not Responding**
```typescript
// Add timeout handling
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('SDK timeout')), 300000); // 5 minutes
});

const result = await Promise.race([sdkQuery, timeoutPromise]);
```

**Authentication Errors**
```typescript
// The authentication manager handles this automatically
// Check logs for authentication refresh attempts
```

**File Operation Failures**
```typescript
// Verify working directory and permissions
const stats = fs.statSync(options.cwd);
if (!stats.isDirectory()) {
  throw new Error('Working directory does not exist');
}
```

### Debug Mode

Enable debug logging for detailed SDK interaction logs:

```bash
LOG_LEVEL=debug npm run dev
```

This will show:
- All SDK messages
- Processing times
- Token usage
- Tool interactions
- File operations
- System configurations

## Future Enhancements

### Planned Features

1. **Enhanced Tool Support**: Additional development tools
2. **Multi-language Support**: Better language-specific features
3. **Performance Optimization**: Faster processing and streaming
4. **Advanced File Operations**: Binary file support
5. **Custom Tool Integration**: Plugin system for custom tools

### SDK Updates

The service automatically benefits from SDK updates. Monitor the official releases:

```bash
npm update @anthropic-ai/claude-code
```

Check the changelog for new features and improvements.

## Resources

- **Official Documentation**: Check Anthropic's documentation for the latest features
- **GitHub Issues**: Report bugs and feature requests
- **Community**: Join discussions about Claude Code integration
- **Examples**: See the test suites for usage examples
