# Reasoning Summary Streaming Feature

## Overview

The ClaudeCode API now supports streaming reasoning summary updates during long-running operations. This feature provides clients with real-time updates about the assistant's current reasoning state and progress, enhancing the user experience during potentially lengthy Claude Code SDK processing.

## How to Enable

To enable reasoning streaming, include the `reasoning: true` field in your Responses API request:

```json
{
  "messages": [
    {
      "role": "user", 
      "content": "Create a React component for a todo app"
    }
  ],
  "stream": true,
  "reasoning": true
}
```

**Note**: Reasoning summaries are only available in streaming mode (`stream: true`). The `reasoning` field is ignored for non-streaming requests.

## SSE Event Types

When reasoning is enabled, the streaming API will emit additional Server-Sent Events:

### `response.reasoning_summary.delta`

This event provides incremental reasoning updates during processing.

**Event Structure:**
```
event: response.reasoning_summary.delta
data: {
  "type": "response.reasoning_summary.delta",
  "delta": {
    "type": "progress|tool_use|system_info",
    "summary": "Human-readable reasoning summary",
    "details": {
      // Additional context specific to the reasoning type
    }
  }
}
```

### Reasoning Types

#### 1. `progress`
General progress updates about request processing.

**Example:**
```json
{
  "type": "progress",
  "summary": "Processing user request...",
  "details": {
    "messageId": "msg_123",
    "contentLength": 150
  }
}
```

#### 2. `tool_use`
Updates when the assistant uses specific tools.

**Example:**
```json
{
  "type": "tool_use", 
  "summary": "Creating new file: components/TodoApp.jsx...",
  "details": {
    "toolName": "create_file",
    "toolId": "tool_456",
    "inputKeys": ["file_path", "contents", "summary"]
  }
}
```

**Supported Tools:**
- `create_file`: "Creating new file: {filename}..."
- `edit_files`: "Editing file: {filename}..." or "Editing {count} files..."
- `read_files`: "Reading {count} file(s)..."
- `run_command`: "Executing command: {command}..."
- `search_codebase`: "Searching codebase for: {query}..."
- `grep`: "Searching for: {terms}..."

#### 3. `system_info`
System-level configuration and setup updates.

**Example:**
```json
{
  "type": "system_info",
  "summary": "Setting up system environment with 15 tools and 2 MCP servers...",
  "details": {
    "subtype": "system_setup",
    "tools": [...],
    "mcpServers": 2
  }
}
```

## Example Streaming Response

Here's an example of a complete streaming response with reasoning enabled:

```
event: response.created
data: {"type":"response.created","response":{"id":"resp_123","object":"response","created":1703123456,"model":"claude-3-5-sonnet-20241022","status":"in_progress"}}

event: response.output_item.added
data: {"type":"response.output_item.added","output_index":0,"item":{"id":"msg_456","type":"message","role":"assistant","content":[]}}

event: response.reasoning_summary.delta
data: {"type":"response.reasoning_summary.delta","delta":{"type":"system_info","summary":"Setting up system environment with 15 tools...","details":{"subtype":"system_setup","tools":[...],"mcpServers":0}}}

event: response.reasoning_summary.delta
data: {"type":"response.reasoning_summary.delta","delta":{"type":"progress","summary":"Processing user request...","details":{"messageId":"msg_789","contentLength":45}}}

event: response.reasoning_summary.delta  
data: {"type":"response.reasoning_summary.delta","delta":{"type":"tool_use","summary":"Creating new file: components/TodoApp.jsx...","details":{"toolName":"create_file","toolId":"tool_123","inputKeys":["file_path","contents","summary"]}}}

event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"I'll help you create a React component for a todo app. Let me start by creating the main component file.\n\n"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"**Created file: components/TodoApp.jsx**\n\n```jsx\nimport React, { useState } from 'react';\n\n// Component code here...\n```"}

event: response.output_item.done
data: {"type":"response.output_item.done","output_index":0,"item":{"id":"msg_456","type":"message","role":"assistant","content":[{"type":"text","text":"I'll help you create a React component..."}]}}

event: response.completed  
data: {"type":"response.completed","response":{"id":"resp_123","object":"response","created":1703123456,"model":"claude-3-5-sonnet-20241022","status":"completed","output":[...],"usage":{...}}}

event: done
data: [DONE]
```

## Implementation Details

### Service Layer
- The `ClaudeCodeService.processStreamRequest()` method accepts an optional `enableReasoning` parameter
- Reasoning extraction occurs at multiple points:
  - System messages → `extractReasoningFromSystemMessage()`
  - Tool usage → `extractReasoningFromToolUse()`  
  - General progress updates

### Controller Layer
- The responses controller passes the `reasoning` flag from the request to the service
- Reasoning stream chunks are converted to `response.reasoning_summary.delta` SSE events

### Type Definitions
- `ClaudeCodeStreamResponse` supports a new `'reasoning'` type
- Includes optional `reasoning` object with `type`, `summary`, and `details` fields
- `ResponseRequest` includes optional `reasoning: boolean` field

## Benefits

1. **Enhanced User Experience**: Users get real-time feedback about what the assistant is doing
2. **Progress Transparency**: Long operations show clear progress indicators
3. **Tool Visibility**: Users can see which tools are being used and when
4. **Debug Information**: Developers can trace the assistant's reasoning process
5. **Interactive Feel**: Streaming feels more responsive and engaging

## Backward Compatibility

This feature is fully backward compatible:
- Existing clients that don't set `reasoning: true` will see no changes
- The feature only activates when explicitly requested
- All existing SSE events remain unchanged

## Future Enhancements

Potential future improvements:
- Estimated completion percentages
- More granular tool operation status
- Reasoning summaries for assistant text generation
- Custom reasoning filters/preferences
