# Claude Code API

An OpenAI-compatible API service powered by Claude Code that provides agentic capabilities through traditional chat completion endpoints.

## Overview

This service acts as a bridge between OpenAI's Chat Completions API format and Claude Code's agentic capabilities. Users can use any OpenAI-compatible client to interact with Claude Code's advanced development features.

## Features

- ✅ **Real Claude Code SDK Integration** - Uses official @anthropic-ai/claude-code SDK
- ✅ OpenAI Chat Completions API compatibility
- ✅ **OpenAI Responses API (2025)** - Modern agentic API format
- ✅ Streaming responses support
- ✅ Multiple model endpoints
- ✅ Comprehensive error handling
- ✅ Request validation and authentication
- ✅ **Detailed Claude Code SDK Logging** - Complete visibility into SDK interactions
- ✅ Structured logging with Winston
- ✅ Health check endpoints
- ✅ TypeScript implementation with strict types

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` file:
```env
PORT=3000
NODE_ENV=development
# Claude Code uses its own built-in authentication system
# No API keys required for Claude Code SDK
OPENAI_API_KEY_REQUIRED=false
LOG_LEVEL=info
CORS_ORIGIN=*
```

**Important:** Claude Code SDK uses its own built-in authentication system. No API keys are required!

### 3. Development

Start the development server with hot reload:

```bash
npm run dev
```

### 4. Production

Build and start the production server:

```bash
npm run build
npm start
```

## API Endpoints

### Chat Completions

**POST** `/v1/chat/completions`

Compatible with OpenAI's Chat Completions API format. Uses Claude Code SDK under the hood for agentic capabilities.

### Responses API (2025)

**POST** `/v1/responses`

New OpenAI Responses API format for modern agentic workflows. Provides enhanced tool use and state management.

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Write a TypeScript function that calculates fibonacci numbers"}
    ],
    "stream": false
  }'
```

#### Responses API Example

```bash
curl -X POST http://localhost:3000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "o3",
    "messages": [
      {"role": "user", "content": "Create a Python web scraper for extracting product data"}
    ],
    "tools": [{"type": "code_interpreter"}],
    "stream": false
  }'
```

#### Available Models

The service supports all major OpenAI models:
- `claude-code-v1` - Default Claude Code model
- `gpt-3.5-turbo` - GPT-3.5 Turbo
- `gpt-4` - GPT-4 base model
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-4o` - GPT-4 Omni
- `gpt-4o-mini` - GPT-4 Omni Mini
- `o1` - OpenAI o1 reasoning model
- `o1-mini` - OpenAI o1 Mini
- `o3` - **NEW** OpenAI o3 advanced reasoning model
- `o3-mini` - **NEW** OpenAI o3 Mini

#### Streaming Support

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Explain how to implement a binary search tree"}
    ],
    "stream": true
  }'
```

### Models

**GET** `/v1/models`

List available models:

```bash
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer your-api-key"
```

**GET** `/v1/models/{model}`

Get specific model details:

```bash
curl http://localhost:3000/v1/models/gpt-4 \
  -H "Authorization: Bearer your-api-key"
```

### Health Checks

- **GET** `/health` - General health status
- **GET** `/health/ready` - Readiness probe
- **GET** `/health/live` - Liveness probe

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `OPENAI_API_KEY_REQUIRED` | Require API key auth | `false` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `CORS_ORIGIN` | CORS allowed origins | `*` | No |

**Note:** Claude Code SDK handles authentication internally - no API keys needed!

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
        {"role": "user", "content": "Help me debug this Python error: NameError: name 'x' is not defined"}
    ]
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

const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
        { role: 'user', content: 'Create a React component for a todo list' }
    ],
    stream: true
});

for await (const chunk of response) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### cURL

```bash
# Basic request
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "You are a helpful coding assistant."},
      {"role": "user", "content": "How do I implement authentication in Express.js?"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

## Supported Parameters

The API supports standard OpenAI parameters:

- `model` - Model to use (required)
- `messages` - Array of message objects (required)
- `temperature` - Controls randomness (0-2)
- `max_tokens` - Maximum tokens to generate
- `top_p` - Nucleus sampling parameter
- `frequency_penalty` - Frequency penalty (-2 to 2)
- `presence_penalty` - Presence penalty (-2 to 2)
- `stop` - Stop sequences
- `stream` - Enable streaming responses
- `user` - User identifier

## Architecture

```
src/
├── config/           # Environment configuration
├── controllers/      # Route handlers
├── middleware/       # Express middleware
├── services/         # Business logic and Claude Code integration
├── types/           # TypeScript interfaces
├── utils/           # Utilities and helpers
└── app.ts           # Express application setup
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run typecheck` - Type checking
- `npm run lint` - Linting (placeholder)

### Adding New Endpoints

1. Create route handler in `src/controllers/`
2. Add middleware if needed in `src/middleware/`
3. Register routes in `src/app.ts`
4. Add types in `src/types/`

## Error Handling

The API returns OpenAI-compatible error responses:

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

## Logging

Structured JSON logging using Winston:

- Console output in development
- File output in production (`logs/` directory)
- Configurable log levels via `LOG_LEVEL` environment variable

## Security

- CORS protection with configurable origins
- Helmet.js security headers
- Request validation middleware
- Optional API key authentication
- Input sanitization

## Troubleshooting

### Common Issues

**Port already in use**
```bash
lsof -ti:3000 | xargs kill -9
```

**TypeScript compilation errors**
```bash
npm run typecheck
```

**Missing logs directory**
```bash
mkdir logs
```

### Debug Mode

Set `LOG_LEVEL=debug` for verbose logging including detailed Claude Code SDK interactions:

```env
LOG_LEVEL=debug
```

**Debug logging includes:**
- Claude Code SDK message details (type, UUID, content)
- Request/response transformation steps
- Token usage and processing times
- System messages and tool interactions
- Streaming chunk details
- Permission denials and error details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License - see package.json for details.