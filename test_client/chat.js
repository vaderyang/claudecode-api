#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import boxen from 'boxen';
import wrap from 'word-wrap';
import fs from 'fs-extra';
import moment from 'moment';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ClaudeChatClient {
  constructor() {
    this.config = this.loadConfig();
    this.conversation = [];
    this.sessionId = this.generateSessionId();
    this.chatHistory = [];
    this.isStreaming = false;
  }

  generateSessionId() {
    return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    const defaultConfig = {
      baseURL: 'http://localhost:3000',
      apiKey: 'your-api-key-here',
      model: 'claude-sonnet',
      api: 'responses', // 'chat' or 'responses'
      streaming: true,  // Always default to streaming for better UX
      reasoning: true,
      maxTokens: 4000,
      temperature: 0.7,
      theme: 'auto', // 'light', 'dark', 'auto'
      saveHistory: true,
      historyLimit: 100,
      showInstantFeedback: true // Show immediate feedback while SDK loads
    };

    try {
      if (fs.existsSync(configPath)) {
        const savedConfig = fs.readJsonSync(configPath);
        return { ...defaultConfig, ...savedConfig };
      }
    } catch (error) {
      // If config is corrupted, use defaults
    }

    return defaultConfig;
  }

  saveConfig() {
    const configPath = path.join(__dirname, 'config.json');
    try {
      fs.writeJsonSync(configPath, this.config, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red('Failed to save config:'), error.message);
    }
  }

  loadChatHistory() {
    if (!this.config.saveHistory) return [];

    const historyPath = path.join(__dirname, 'chat-history.json');
    try {
      if (fs.existsSync(historyPath)) {
        return fs.readJsonSync(historyPath) || [];
      }
    } catch (error) {
      // If history is corrupted, start fresh
    }
    return [];
  }

  saveChatHistory() {
    if (!this.config.saveHistory) return;

    const historyPath = path.join(__dirname, 'chat-history.json');
    try {
      // Keep only the last N messages according to historyLimit
      const limitedHistory = this.chatHistory.slice(-this.config.historyLimit);
      fs.writeJsonSync(historyPath, limitedHistory, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red('Failed to save chat history:'), error.message);
    }
  }

  displayWelcome() {
    const welcome = boxen(
      chalk.cyan.bold('🤖 Claude CLI Chat Client') + '\n\n' +
      chalk.white('Welcome to your interactive chat with Claude!') + '\n' +
      chalk.gray('Type /help for commands or just start chatting.') + '\n' +
      chalk.gray(`Model: ${this.config.model} | API: ${this.config.api} | Streaming: ${this.config.streaming ? 'ON' : 'OFF'}`),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    );
    console.log(welcome);
  }

  displayHelp() {
    const helpText = `
${chalk.cyan.bold('Available Commands:')}

${chalk.yellow('/help')}          - Show this help message
${chalk.yellow('/config')}        - Configure client settings
${chalk.yellow('/history')}       - View chat history
${chalk.yellow('/clear')}         - Clear current conversation
${chalk.yellow('/save <name>')}   - Save current conversation
${chalk.yellow('/load <name>')}   - Load a saved conversation
${chalk.yellow('/sessions')}      - List saved conversations
${chalk.yellow('/model <name>')}  - Switch model (claude-sonnet, claude-4-sonnet)
${chalk.yellow('/api <type>')}    - Switch API (chat, responses)
${chalk.yellow('/stream')}        - Toggle streaming mode
${chalk.yellow('/reasoning')}     - Toggle reasoning display (Responses API)
${chalk.yellow('/feedback')}      - Toggle instant loading feedback
${chalk.yellow('/export')}        - Export current conversation to file
${chalk.yellow('/stats')}         - Show session statistics
${chalk.yellow('/quit')} or ${chalk.yellow('/exit')} - Exit the chat

${chalk.green.bold('Tips:')}
- Use ${chalk.cyan('Ctrl+C')} to stop streaming responses
- Multi-line input: Use ${chalk.cyan('\\\\')} at the end of a line to continue
- Your conversation history is automatically saved
- Streaming is ${chalk.green('enabled by default')} for better responsiveness
`;

    console.log(helpText);
  }

  formatMessage(message, role, timestamp = new Date(), reasoning = null) {
    const timeStr = moment(timestamp).format('HH:mm:ss');
    const roleColor = role === 'user' ? chalk.blue : chalk.green;
    const roleIcon = role === 'user' ? '👤' : '🤖';
    
    // Wrap long messages
    const wrappedContent = wrap(message, {
      width: Math.min(80, process.stdout.columns - 10),
      indent: '    '
    });

    let formatted = `${roleColor.bold(`${roleIcon} ${role.toUpperCase()}`)} ${chalk.gray(`[${timeStr}]`)}\n`;
    formatted += `${wrappedContent}\n`;

    if (reasoning && reasoning.length > 0) {
      formatted += chalk.yellow('\n🧠 Reasoning:\n');
      reasoning.forEach(r => {
        formatted += chalk.yellow(`   • ${r}\n`);
      });
    }

    return formatted;
  }

  async sendMessage(message) {
    // Add user message to conversation
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    this.conversation.push(userMessage);
    this.chatHistory.push(userMessage);

    // Display user message
    console.log(this.formatMessage(message, 'user'));

    // Always show immediate feedback for streaming
    if (this.config.streaming) {
      console.log(chalk.green.bold('\n🤖 CLAUDE') + chalk.gray(` [${moment().format('HH:mm:ss')}]`));
      if (this.config.showInstantFeedback) {
        process.stdout.write(chalk.yellow('💭 Connecting to Claude...'));
        // Simple animated dots
        let dotCount = 0;
        const loadingInterval = setInterval(() => {
          dotCount = (dotCount + 1) % 4;
          const dots = '.'.repeat(dotCount);
          process.stdout.write(`\r${chalk.yellow('💭 Connecting to Claude')}${chalk.yellow(dots)}${' '.repeat(3 - dotCount)}`);
        }, 300);
        
        // Clear interval when we get first response data (handled in streaming functions)
        this.loadingInterval = loadingInterval;
      }
    }

    const spinner = this.config.streaming ? null : ora('Claude is thinking...').start();
    
    try {
      let response;
      let reasoning = [];

      if (this.config.api === 'responses') {
        response = await this.sendResponsesAPIRequest(message, reasoning);
      } else {
        response = await this.sendChatCompletionRequest(message);
      }

      if (spinner) spinner.stop();

      // Add assistant response to conversation
      const assistantMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        reasoning: reasoning.length > 0 ? reasoning : null
      };

      this.conversation.push(assistantMessage);
      this.chatHistory.push(assistantMessage);

      if (!this.config.streaming) {
        console.log(this.formatMessage(response, 'assistant', assistantMessage.timestamp, reasoning));
      }

      this.saveChatHistory();

    } catch (error) {
      // Clean up loading animation on error
      if (this.loadingInterval) {
        clearInterval(this.loadingInterval);
        this.loadingInterval = null;
        process.stdout.write('\r' + ' '.repeat(30) + '\r');
      }
      if (spinner) spinner.stop();
      
      console.error(chalk.red('\n❌ Error:'), error.message);
      
      if (error.response?.status === 401) {
        console.log(chalk.yellow('\n💡 Hint: Check your API key with /config'));
      } else if (error.code === 'ECONNREFUSED') {
        console.log(chalk.yellow('\n💡 Hint: Make sure the API server is running on'), chalk.cyan(this.config.baseURL));
      }
    }
  }

  async sendChatCompletionRequest(message) {
    const url = `${this.config.baseURL}/v1/chat/completions`;
    
    const payload = {
      model: this.config.model,
      messages: this.conversation.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: this.config.streaming,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    };

    if (this.config.streaming) {
      return await this.handleChatStreaming(url, payload);
    } else {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    }
  }

  async sendResponsesAPIRequest(message, reasoning) {
    const url = `${this.config.baseURL}/v1/responses`;
    
    const payload = {
      model: this.config.model,
      messages: this.conversation.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: this.config.streaming,
      reasoning: this.config.reasoning,
      metadata: {
        session_id: this.sessionId
      }
    };

    if (this.config.streaming) {
      return await this.handleResponsesStreaming(url, payload, reasoning);
    } else {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const message = response.data.messages[0];
      return message.content[0].text.value;
    }
  }

  async handleChatStreaming(url, payload) {
    return new Promise((resolve, reject) => {
      let fullResponse = '';
      let currentLine = '';
      let hasStartedStreaming = false;
      this.isStreaming = true;

      // Don't show header again if we already showed it in sendMessage
      if (!this.config.showInstantFeedback) {
        console.log(chalk.green.bold('\n🤖 CLAUDE') + chalk.gray(` [${moment().format('HH:mm:ss')}]`));
      }

      axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }).then(response => {
        response.data.on('data', (chunk) => {
          // Clear the loading animation once we start getting real data
          if (!hasStartedStreaming && this.config.showInstantFeedback) {
            if (this.loadingInterval) {
              clearInterval(this.loadingInterval);
              this.loadingInterval = null;
            }
            process.stdout.write('\r' + ' '.repeat(30) + '\r'); // Clear the loading line
            hasStartedStreaming = true;
          }
          
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                console.log('\n');
                this.isStreaming = false;
                resolve(fullResponse);
                return;
              }
              
              try {
                const jsonData = JSON.parse(data);
                if (jsonData.choices && jsonData.choices[0] && jsonData.choices[0].delta) {
                  const content = jsonData.choices[0].delta.content;
                  if (content) {
                    process.stdout.write(chalk.white(content));
                    fullResponse += content;
                    currentLine += content;
                    
                    // Handle line breaks for better formatting
                    if (content.includes('\n')) {
                      currentLine = '';
                    }
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        });

        response.data.on('end', () => {
          if (this.isStreaming) {
            console.log('\n');
            this.isStreaming = false;
            resolve(fullResponse);
          }
        });

        response.data.on('error', (error) => {
          this.isStreaming = false;
          reject(error);
        });

      }).catch(reject);
    });
  }

  async handleResponsesStreaming(url, payload, reasoning) {
    return new Promise((resolve, reject) => {
      let fullResponse = '';
      let currentLine = '';
      let hasStartedStreaming = false;
      this.isStreaming = true;

      // Don't show header again if we already showed it in sendMessage
      if (!this.config.showInstantFeedback) {
        console.log(chalk.green.bold('\n🤖 CLAUDE') + chalk.gray(` [${moment().format('HH:mm:ss')}]`));
      }

      axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }).then(response => {
        response.data.on('data', (chunk) => {
          // Clear the loading animation once we start getting real data
          if (!hasStartedStreaming) {
            if (this.config.showInstantFeedback && this.loadingInterval) {
              clearInterval(this.loadingInterval);
              this.loadingInterval = null;
              process.stdout.write('\r' + ' '.repeat(30) + '\r'); // Clear the loading line
            }
            hasStartedStreaming = true;
          }
          
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                console.log('\n');
                this.isStreaming = false;
                resolve(fullResponse);
                return;
              }
              
              try {
                const jsonData = JSON.parse(data);
                
                if (jsonData.type === 'response.output_text.delta') {
                  const content = jsonData.delta;
                  if (content) {
                    process.stdout.write(chalk.white(content));
                    fullResponse += content;
                  }
                } else if (jsonData.type === 'response.reasoning_summary.delta' && this.config.reasoning) {
                  const reasoningText = jsonData.delta.summary;
                  if (reasoningText && reasoningText.trim()) {
                    reasoning.push(reasoningText);
                    // Show reasoning with better formatting and colors
                    console.log(chalk.cyan(`\n💭 ${reasoningText}`));
                  }
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        });

        response.data.on('end', () => {
          if (this.isStreaming) {
            console.log('\n');
            this.isStreaming = false;
            resolve(fullResponse);
          }
        });

        response.data.on('error', (error) => {
          this.isStreaming = false;
          reject(error);
        });

      }).catch(reject);
    });
  }

  async handleCommand(input) {
    const [command, ...args] = input.slice(1).split(' ');
    
    switch (command.toLowerCase()) {
      case 'help':
        this.displayHelp();
        break;
        
      case 'config':
        await this.showConfig();
        break;
        
      case 'clear':
        this.conversation = [];
        console.log(chalk.green('✅ Conversation cleared!'));
        break;
        
      case 'history':
        this.showHistory();
        break;
        
      case 'model':
        if (args.length > 0) {
          this.config.model = args[0];
          this.saveConfig();
          console.log(chalk.green(`✅ Model changed to: ${this.config.model}`));
        } else {
          console.log(chalk.yellow(`Current model: ${this.config.model}`));
        }
        break;
        
      case 'api':
        if (args.length > 0 && ['chat', 'responses'].includes(args[0])) {
          this.config.api = args[0];
          this.saveConfig();
          console.log(chalk.green(`✅ API changed to: ${this.config.api}`));
        } else {
          console.log(chalk.yellow(`Current API: ${this.config.api}`));
          console.log(chalk.gray('Valid options: chat, responses'));
        }
        break;
        
      case 'stream':
        this.config.streaming = !this.config.streaming;
        this.saveConfig();
        console.log(chalk.green(`✅ Streaming ${this.config.streaming ? 'enabled' : 'disabled'}`));
        break;
        
      case 'reasoning':
        if (this.config.api === 'responses') {
          this.config.reasoning = !this.config.reasoning;
          this.saveConfig();
          console.log(chalk.green(`✅ Reasoning display ${this.config.reasoning ? 'enabled' : 'disabled'}`));
        } else {
          console.log(chalk.yellow('⚠️  Reasoning is only available with the Responses API'));
        }
        break;
        
      case 'feedback':
        this.config.showInstantFeedback = !this.config.showInstantFeedback;
        this.saveConfig();
        console.log(chalk.green(`✅ Instant feedback ${this.config.showInstantFeedback ? 'enabled' : 'disabled'}`));
        break;
        
      case 'stats':
        this.showStats();
        break;
        
      case 'export':
        await this.exportConversation(args[0]);
        break;
        
      case 'save':
        await this.saveConversation(args[0]);
        break;
        
      case 'load':
        await this.loadConversation(args[0]);
        break;
        
      case 'sessions':
        this.listSavedSessions();
        break;
        
      case 'quit':
      case 'exit':
        console.log(chalk.yellow('\n👋 Thanks for chatting with Claude!'));
        process.exit(0);
        break;
        
      default:
        console.log(chalk.red(`Unknown command: ${command}`));
        console.log(chalk.gray('Type /help for available commands'));
    }
  }

  async showConfig() {
    console.log(chalk.blue('\n⚙️  Current Configuration:'));
    console.log(`${chalk.yellow('Base URL:')} ${this.config.baseURL}`);
    console.log(`${chalk.yellow('API Key:')} ${this.config.apiKey.slice(0, 10)}...`);
    console.log(`${chalk.yellow('Model:')} ${this.config.model}`);
    console.log(`${chalk.yellow('API:')} ${this.config.api}`);
    console.log(`${chalk.yellow('Streaming:')} ${this.config.streaming ? 'ON' : 'OFF'}`);
    console.log(`${chalk.yellow('Reasoning:')} ${this.config.reasoning ? 'ON' : 'OFF'}`);
    console.log(`${chalk.yellow('Max Tokens:')} ${this.config.maxTokens}`);
    console.log(`${chalk.yellow('Temperature:')} ${this.config.temperature}`);

    const { change } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'change',
        message: 'Would you like to change any settings?',
        default: false
      }
    ]);

    if (change) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseURL',
          message: 'Base URL:',
          default: this.config.baseURL
        },
        {
          type: 'input',
          name: 'apiKey',
          message: 'API Key:',
          default: this.config.apiKey
        },
        {
          type: 'list',
          name: 'model',
          message: 'Model:',
          choices: ['claude-sonnet', 'claude-4-sonnet'],
          default: this.config.model
        },
        {
          type: 'list',
          name: 'api',
          message: 'API:',
          choices: [
            { name: 'Responses API (with reasoning)', value: 'responses' },
            { name: 'Chat Completions API', value: 'chat' }
          ],
          default: this.config.api
        },
        {
          type: 'confirm',
          name: 'streaming',
          message: 'Enable streaming?',
          default: this.config.streaming
        },
        {
          type: 'confirm',
          name: 'reasoning',
          message: 'Enable reasoning display?',
          default: this.config.reasoning,
          when: (answers) => answers.api === 'responses'
        }
      ]);

      Object.assign(this.config, answers);
      this.saveConfig();
      console.log(chalk.green('\n✅ Configuration saved!'));
    }
  }

  showHistory() {
    if (this.chatHistory.length === 0) {
      console.log(chalk.yellow('📭 No chat history yet.'));
      return;
    }

    console.log(chalk.blue(`\n📚 Chat History (${this.chatHistory.length} messages):`));
    console.log(chalk.gray('─'.repeat(60)));

    this.chatHistory.slice(-10).forEach(msg => {
      console.log(this.formatMessage(msg.content, msg.role, msg.timestamp, msg.reasoning));
      console.log(chalk.gray('─'.repeat(40)));
    });

    if (this.chatHistory.length > 10) {
      console.log(chalk.gray(`... and ${this.chatHistory.length - 10} more messages`));
    }
  }

  showStats() {
    const userMessages = this.conversation.filter(m => m.role === 'user').length;
    const assistantMessages = this.conversation.filter(m => m.role === 'assistant').length;
    const totalChars = this.conversation.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.floor(totalChars / 4);

    console.log(chalk.blue('\n📊 Session Statistics:'));
    console.log(`${chalk.yellow('Messages:')} ${userMessages} from you, ${assistantMessages} from Claude`);
    console.log(`${chalk.yellow('Total characters:')} ${totalChars.toLocaleString()}`);
    console.log(`${chalk.yellow('Estimated tokens:')} ~${estimatedTokens.toLocaleString()}`);
    console.log(`${chalk.yellow('Session ID:')} ${this.sessionId}`);
    console.log(`${chalk.yellow('Started:')} ${moment(this.sessionStart || new Date()).format('YYYY-MM-DD HH:mm:ss')}`);
  }

  async exportConversation(filename) {
    if (this.conversation.length === 0) {
      console.log(chalk.yellow('📭 No conversation to export.'));
      return;
    }

    const defaultName = `conversation-${moment().format('YYYY-MM-DD-HH-mm-ss')}.json`;
    const exportName = filename || defaultName;
    const exportPath = path.join(__dirname, 'exports', exportName);

    try {
      await fs.ensureDir(path.dirname(exportPath));
      await fs.writeJson(exportPath, {
        sessionId: this.sessionId,
        timestamp: new Date(),
        config: this.config,
        conversation: this.conversation
      }, { spaces: 2 });

      console.log(chalk.green(`✅ Conversation exported to: ${exportPath}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to export conversation:'), error.message);
    }
  }

  async saveConversation(name) {
    if (!name) {
      console.log(chalk.red('❌ Please provide a name for the conversation.'));
      console.log(chalk.gray('Usage: /save <name>'));
      return;
    }

    if (this.conversation.length === 0) {
      console.log(chalk.yellow('📭 No conversation to save.'));
      return;
    }

    try {
      const sessionsDir = path.join(__dirname, 'sessions');
      await fs.ensureDir(sessionsDir);
      
      const sessionPath = path.join(sessionsDir, `${name}.json`);
      await fs.writeJson(sessionPath, {
        name,
        sessionId: this.sessionId,
        timestamp: new Date(),
        conversation: this.conversation
      }, { spaces: 2 });

      console.log(chalk.green(`✅ Conversation saved as: ${name}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to save conversation:'), error.message);
    }
  }

  async loadConversation(name) {
    if (!name) {
      console.log(chalk.red('❌ Please provide the name of the conversation to load.'));
      console.log(chalk.gray('Usage: /load <name>'));
      return;
    }

    try {
      const sessionPath = path.join(__dirname, 'sessions', `${name}.json`);
      const session = await fs.readJson(sessionPath);
      
      this.conversation = session.conversation || [];
      this.sessionId = session.sessionId || this.generateSessionId();
      
      console.log(chalk.green(`✅ Loaded conversation: ${name}`));
      console.log(chalk.gray(`Session ID: ${this.sessionId}`));
      console.log(chalk.gray(`Messages: ${this.conversation.length}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to load conversation:'), error.message);
    }
  }

  listSavedSessions() {
    try {
      const sessionsDir = path.join(__dirname, 'sessions');
      if (!fs.existsSync(sessionsDir)) {
        console.log(chalk.yellow('📭 No saved sessions found.'));
        return;
      }

      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      
      if (files.length === 0) {
        console.log(chalk.yellow('📭 No saved sessions found.'));
        return;
      }

      console.log(chalk.blue('\n💾 Saved Sessions:'));
      files.forEach(file => {
        const name = file.replace('.json', '');
        const filePath = path.join(sessionsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`${chalk.green('•')} ${chalk.yellow(name)} ${chalk.gray(`(${moment(stats.mtime).fromNow()})`)}`);
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to list sessions:'), error.message);
    }
  }

  async startChat() {
    this.sessionStart = new Date();
    this.chatHistory = this.loadChatHistory();
    
    this.displayWelcome();

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      if (this.isStreaming) {
        console.log(chalk.yellow('\n\n⏸️  Stopping stream...'));
        this.isStreaming = false;
        this.promptUser();
      } else {
        console.log(chalk.yellow('\n\n👋 Goodbye!'));
        process.exit(0);
      }
    });

    await this.promptUser();
  }

  async promptUser() {
    while (true) {
      try {
        const { message } = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: chalk.blue('You:'),
            prefix: ''
          }
        ]);

        if (!message.trim()) continue;

        if (message.startsWith('/')) {
          await this.handleCommand(message);
        } else {
          await this.sendMessage(message);
        }
      } catch (error) {
        if (error.name === 'ExitPromptError') {
          console.log(chalk.yellow('\n👋 Goodbye!'));
          break;
        }
        console.error(chalk.red('Error:'), error.message);
      }
    }
  }
}

// Start the chat client
const client = new ClaudeChatClient();
client.startChat().catch(console.error);