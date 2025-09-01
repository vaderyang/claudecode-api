# Claude CLI Chat Client

A beautiful, interactive command-line chat client for Claude Code API with rich formatting, conversation management, and advanced features.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start chatting
npm start
# or
node chat.js
```

## ✨ Features

### 🗨️ **Interactive Chat Interface**
- Real-time streaming responses with beautiful formatting
- Multi-line input support with `\\` continuation
- Graceful interrupt handling (Ctrl+C)
- Rich terminal colors and formatting
- Auto-wrapping for long messages

### 🧠 **Dual API Support**
- **Responses API**: Enhanced streaming with reasoning token display
- **Chat Completions API**: Standard OpenAI-compatible interface
- Easy switching between APIs with `/api` command

### 💾 **Conversation Management**
- **Auto-save**: Chat history automatically saved
- **Named Sessions**: Save and load conversations with custom names
- **Export**: Export conversations to JSON files
- **History Limit**: Configurable history length

### ⚙️ **Configuration**
- **Persistent Settings**: All settings saved automatically
- **Interactive Config**: Easy configuration through `/config` command
- **Multiple Models**: Switch between Claude models on the fly
- **Streaming Control**: Toggle streaming mode anytime

### 📊 **Statistics & Monitoring**
- Session statistics (messages, tokens, duration)
- Real-time reasoning display
- Token usage tracking
- Performance monitoring

## 🎮 Commands

### Chat Commands
| Command | Description |
|---------|-------------|
| `/help` | Show help message |
| `/config` | Configure client settings |
| `/clear` | Clear current conversation |
| `/history` | View chat history |
| `/stats` | Show session statistics |

### Session Management
| Command | Description |
|---------|-------------|
| `/save <name>` | Save current conversation |
| `/load <name>` | Load saved conversation |
| `/sessions` | List all saved sessions |
| `/export [filename]` | Export conversation to file |

### Settings
| Command | Description |
|---------|-------------|
| `/model <name>` | Switch model (claude-sonnet, claude-4-sonnet) |
| `/api <type>` | Switch API (chat, responses) |
| `/stream` | Toggle streaming mode |
| `/reasoning` | Toggle reasoning display (Responses API only) |

### System
| Command | Description |
|---------|-------------|
| `/quit` or `/exit` | Exit the chat |

## 🛠️ Configuration Options

The client automatically creates a `config.json` file with these settings:

```json
{
  "baseURL": "http://localhost:3000",
  "apiKey": "your-api-key-here",
  "model": "claude-sonnet",
  "api": "responses",
  "streaming": true,
  "reasoning": true,
  "maxTokens": 4000,
  "temperature": 0.7,
  "theme": "auto",
  "saveHistory": true,
  "historyLimit": 100
}
```

## 📁 File Structure

After using the client, you'll see these files/folders:

```
test_client/
├── chat.js              # Main chat client
├── index.js             # Original test client
├── config.json          # Persistent configuration
├── chat-history.json    # Auto-saved chat history
├── sessions/            # Saved conversation sessions
│   ├── project-planning.json
│   └── debug-session.json
└── exports/             # Exported conversations
    └── conversation-2024-08-31.json
```

## 🎨 Visual Features

### Message Formatting
```
👤 USER [14:30:25]
    Hello! Can you help me with JavaScript?

🤖 CLAUDE [14:30:26]
    Hello! I'd be happy to help you with JavaScript.
    What specific topic or problem would you like to work on?

🧠 Reasoning:
   • Analyzing JavaScript request
   • Preparing comprehensive response
```

### Welcome Screen
```
╭──────────────────────────────────────────────╮
│                                              │
│  🤖 Claude CLI Chat Client                   │
│                                              │
│  Welcome to your interactive chat with       │
│  Claude!                                     │
│  Type /help for commands or just start       │
│  chatting.                                   │
│                                              │
│  Model: claude-sonnet | API: responses |     │
│  Streaming: ON                               │
│                                              │
╰──────────────────────────────────────────────╯
```

## 🔧 Advanced Usage

### Multi-line Input
```
You: This is a long message that I want to \\
     continue on multiple lines \\
     for better readability
```

### Switching APIs
```
You: /api responses
✅ API changed to: responses

You: /reasoning
✅ Reasoning display enabled

You: Now I can see reasoning tokens!
🧠 Reasoning: Analyzing request structure...
🧠 Reasoning: Preparing detailed response...
🤖 CLAUDE: I can now show you my reasoning process...
```

### Session Management
```
You: /save debugging-session
✅ Conversation saved as: debugging-session

You: /sessions
💾 Saved Sessions:
• debugging-session (2 minutes ago)
• project-planning (yesterday)
• learning-python (3 days ago)

You: /load debugging-session
✅ Loaded conversation: debugging-session
```

## 🚦 API Comparison

| Feature | Chat Completions | Responses API |
|---------|------------------|---------------|
| Streaming | ✅ Standard SSE | ✅ Event-based |
| Reasoning Tokens | ❌ | ✅ Real-time display |
| Event Types | Simple | Rich (created, delta, completed) |
| Token Display | Content only | Content + reasoning |
| Interruption | ✅ Ctrl+C | ✅ Ctrl+C |

## 🎯 Use Cases

### Development Workflow
```bash
# Start a coding session
You: /save coding-session
You: Help me debug this JavaScript function...

# Later, continue the session
You: /load coding-session
You: Let's continue where we left off...
```

### Learning & Research
```bash
# Enable reasoning to see thinking process
You: /api responses
You: /reasoning
You: Explain quantum computing concepts

🧠 Reasoning: Breaking down complex quantum concepts...
🧠 Reasoning: Structuring explanation for clarity...
🤖 CLAUDE: Let me explain quantum computing step by step...
```

### Project Planning
```bash
You: /export project-requirements
✅ Conversation exported to: exports/project-requirements.json

# Share the exported file with your team
```

## 🐛 Troubleshooting

### Connection Issues
```bash
You: /config
# Update baseURL and apiKey
```

### Streaming Problems
```bash
You: /stream
✅ Streaming disabled
# Try sending a message, then re-enable if needed
```

### Memory Issues
```bash
You: /clear
✅ Conversation cleared!
# Or adjust historyLimit in config
```

## 🔮 Tips & Tricks

1. **Use Ctrl+C** to interrupt long streaming responses
2. **Save important conversations** before clearing or exiting
3. **Export conversations** for documentation or sharing
4. **Toggle reasoning** to see Claude's thinking process
5. **Use `/stats`** to monitor token usage
6. **Switch models** to compare responses
7. **Load old sessions** to continue conversations

## 🛠️ For Developers

### Testing API Features
```bash
# Keep the original test client for API testing
npm run test "Hello world"

# Use the chat client for interactive development
npm start
```

### Extending the Client
The code is modular and easy to extend:
- Add new commands in `handleCommand()`
- Customize message formatting in `formatMessage()`
- Add new configuration options in `loadConfig()`

## 📝 License

MIT License - feel free to customize and extend!