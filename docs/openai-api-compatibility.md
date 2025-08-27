# OpenAI API Compatibility Guide

## Overview

The Claude Code API provides full compatibility with OpenAI's Chat Completions API, allowing you to use existing OpenAI clients and tools seamlessly with Claude Code's advanced agentic capabilities. This document covers the API endpoints, request/response formats, and compatibility details.

## Base URL

```
http://localhost:3000/v1
```

## Authentication

Authentication is handled through Bearer tokens in the Authorization header:

```http
Authorization: Bearer your-api-key
```

**Note**: By default, authentication is disabled in development mode. Set `OPENAI_API_KEY_REQUIRED=true` in your environment to enable authentication validation.

## Supported Endpoints

### Chat Completions

**Endpoint**: `POST /v1/chat/completions`

Fully compatible with OpenAI's Chat Completions API with Claude Code enhancements.

#### Request Format

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful coding assistant."
    },
    {
      "role": "user", 
      "content": "Create a Python function to calculate fibonacci numbers"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1.0,
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0,
  "stream": false,
  "stop": null,
  "user": "user-123"
}
```

#### Supported Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | **required** | Model to use (any OpenAI model name accepted) |
| `messages` | array | **required** | Array of message objects |
| `temperature` | number | 0.7 | Controls randomness (0-2) |
| `max_tokens` | number | null | Maximum tokens to generate |
| `top_p` | number | 1.0 | Nucleus sampling parameter |
| `frequency_penalty` | number | 0.0 | Frequency penalty (-2 to 2) |
| `presence_penalty` | number | 0.0 | Presence penalty (-2 to 2) |
| `stream` | boolean | false | Enable streaming responses |
| `stop` | string/array | null | Stop sequences |
| `user` | string | null | User identifier for tracking |

#### Response Format (Non-streaming)

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here's a Python function to calculate Fibonacci numbers:\n\n```python\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n```\n\n**Created file: fibonacci.py**\n\n```python\ndef fibonacci(n):\n    \"\"\"Calculate the nth Fibonacci number.\"\"\"\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\ndef fibonacci_iterative(n):\n    \"\"\"More efficient iterative version.\"\"\"\n    if n <= 1:\n        return n\n    \n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b\n\n# Example usage\nif __name__ == \"__main__\":\n    print(f\"Fibonacci(10) = {fibonacci_iterative(10)}\")\n```"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175
  }
}
```

#### Streaming Response Format

When `stream: true` is specified, the response is returned as Server-Sent Events:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Here's"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" a"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":" Python"},"finish_reason":null}]}

...

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### Models

**Endpoint**: `GET /v1/models`

Lists available models in OpenAI-compatible format.

#### Response Format

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1677610602,
      "owned_by": "claude-code-api",
      "permission": [],
      "root": "gpt-4",
      "parent": null
    },
    {
      "id": "gpt-3.5-turbo",
      "object": "model", 
      "created": 1677610602,
      "owned_by": "claude-code-api",
      "permission": [],
      "root": "gpt-3.5-turbo",
      "parent": null
    }
  ]
}
```

**Endpoint**: `GET /v1/models/{model}`

Retrieves information about a specific model.

#### Response Format

```json
{
  "id": "gpt-4",
  "object": "model",
  "created": 1677610602,
  "owned_by": "claude-code-api",
  "permission": [],
  "root": "gpt-4",
  "parent": null
}
```

## Message Format

Messages follow the OpenAI format with three supported roles:

### System Messages

```json
{
  "role": "system",
  "content": "You are a helpful coding assistant that can create and modify files."
}
```

### User Messages

```json
{
  "role": "user",
  "content": "Create a React component for a todo list"
}
```

### Assistant Messages

```json
{
  "role": "assistant", 
  "content": "I'll create a React component for you..."
}
```

## Claude Code Enhancements

While maintaining full OpenAI compatibility, the API provides enhanced capabilities through Claude Code:

### File Operations

Claude Code automatically detects and performs file operations. Created or modified files are included in the response:

```json
{
  "choices": [
    {
      "message": {
        "content": "I've created a React component for you.\n\n**Created file: TodoList.jsx**\n\n```jsx\nimport React, { useState } from 'react';\n\nconst TodoList = () => {\n  // Component implementation\n};\n\nexport default TodoList;\n```"
      }
    }
  ]
}
```

### Enhanced Reasoning (Streaming Only)

When streaming is enabled, the API provides reasoning insights:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"💭 Planning file structure and content organization..."},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"💭 Setting up development environment for file operations..."},"finish_reason":null}]}
```

### Tool Usage

Claude Code has access to development tools:
- File creation and editing
- Command execution
- Code analysis
- Project structure understanding

## Error Handling

Errors follow OpenAI's error format:

```json
{
  "error": {
    "message": "Invalid request: missing required field 'model'",
    "type": "invalid_request_error",
    "param": "model",
    "code": "missing_required_field"
  }
}
```

### Common Error Types

| Error Type | Status Code | Description |
|------------|-------------|-------------|
| `invalid_request_error` | 400 | Invalid request parameters |
| `authentication_error` | 401 | Invalid or missing API key |
| `permission_error` | 403 | Insufficient permissions |
| `not_found_error` | 404 | Resource not found |
| `rate_limit_error` | 429 | Rate limit exceeded |
| `api_error` | 500 | Internal server error |
| `service_unavailable_error` | 503 | Service temporarily unavailable |

## Client Examples

### Python with OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://localhost:3000/v1"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant."},
        {"role": "user", "content": "Create a Python web scraper"}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)
```

### Node.js with OpenAI SDK

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: 'your-api-key',
    baseURL: 'http://localhost:3000/v1'
});

async function createChatCompletion() {
    const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
            { role: 'system', content: 'You are a helpful coding assistant.' },
            { role: 'user', content: 'Build a REST API with Express.js' }
        ],
        stream: false
    });
    
    console.log(response.choices[0].message.content);
}

createChatCompletion();
```

### cURL

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "You are a helpful coding assistant."},
      {"role": "user", "content": "Create a Dockerfile for a Node.js app"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

### Streaming with cURL

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Explain async/await in JavaScript"}
    ],
    "stream": true
  }'
```

## Migration from OpenAI

Migrating from OpenAI to Claude Code API is straightforward:

### 1. Update Base URL

Change your base URL from:
```
https://api.openai.com/v1
```

To:
```
http://localhost:3000/v1
```

### 2. Update API Key (if required)

If authentication is enabled, update your API key to match your Claude Code API configuration.

### 3. Enhanced Features

No code changes required, but you can take advantage of enhanced features:
- **File Operations**: Automatically creates and modifies files
- **Reasoning Insights**: Get real-time thinking process (streaming only)
- **Advanced Tools**: Access to development environment tools

## Performance Considerations

### Response Times

- **Health Endpoints**: < 50ms
- **Model Endpoints**: < 100ms  
- **Chat Completions**: 2-10 seconds (depending on complexity)
- **First Token (Streaming)**: < 100ms with instant reasoning

### Rate Limiting

Currently no rate limiting is implemented. Consider implementing rate limiting for production use.

### Caching

Responses are not cached. Consider implementing response caching for frequently requested completions.

## Monitoring and Debugging

### Health Checks

Monitor API health using the health endpoints:

```bash
# General health
curl http://localhost:3000/health

# Authentication status  
curl http://localhost:3000/health/auth

# Readiness probe
curl http://localhost:3000/health/ready

# Liveness probe
curl http://localhost:3000/health/live
```

### Logging

The API provides comprehensive logging:

```json
{
  "level": "info",
  "message": "Processing chat completion request",
  "requestId": "abc123",
  "model": "gpt-4",
  "messageCount": 2,
  "stream": false,
  "timestamp": "2025-01-24T12:00:00Z"
}
```

### Request Tracing

Each request gets a unique `requestId` for tracing through logs.

## Limitations and Differences

### Current Limitations

1. **Function Calling**: Not yet supported (planned for future release)
2. **Vision**: Image inputs not supported
3. **Fine-tuning**: Not available
4. **Embeddings**: Not supported
5. **Audio**: Speech-to-text and text-to-speech not supported

### Behavioral Differences

1. **Model Names**: All OpenAI model names are accepted but processed by Claude Code
2. **Token Counting**: Approximate token counting used
3. **Rate Limiting**: Not implemented by default
4. **Billing**: No usage-based billing

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```python
try:
    response = client.chat.completions.create(...)
except openai.APIError as e:
    print(f"API error: {e}")
except openai.RateLimitError as e:
    print(f"Rate limit exceeded: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### 2. Streaming for Better UX

Use streaming for long responses:

```python
stream = client.chat.completions.create(
    model="gpt-4",
    messages=[...],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### 3. System Messages

Use system messages to set behavior:

```json
{
  "role": "system",
  "content": "You are a senior software engineer. Always include error handling and comments in code examples."
}
```

### 4. Temperature Control

Adjust temperature based on use case:
- **Code Generation**: 0.1-0.3 (more deterministic)
- **Creative Writing**: 0.7-0.9 (more creative)
- **Analysis**: 0.2-0.5 (balanced)

## Support and Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the server is running
2. **Authentication Errors**: Check API key configuration
3. **Timeouts**: Increase timeout for complex requests
4. **Memory Issues**: Monitor server memory usage

### Getting Help

1. Check server logs for detailed error information
2. Use health endpoints to diagnose service issues
3. Review the test reports for system behavior insights
4. Enable debug logging for detailed request tracing
