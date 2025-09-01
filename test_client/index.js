#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import EventSource from 'eventsource';

class ClaudeCodeAPIClient {
  constructor(baseURL = 'http://localhost:3000', apiKey = 'your-api-key-here') {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.sessionId = null;
  }

  async testChatCompletion(message, model = 'claude-sonnet', streaming = false, reasoning = false) {
    const url = `${this.baseURL}/v1/chat/completions`;
    
    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      stream: streaming,
      max_tokens: 2000,
      temperature: 0.7
    };

    console.log(chalk.blue('\n🚀 Testing Chat Completions API'));
    console.log(chalk.gray('Endpoint:'), url);
    console.log(chalk.gray('Model:'), model);
    console.log(chalk.gray('Streaming:'), streaming);
    console.log(chalk.gray('Message:'), message);
    console.log(chalk.gray('Payload:'), JSON.stringify(payload, null, 2));

    try {
      if (streaming) {
        await this.handleStreamingResponse(url, payload);
      } else {
        await this.handleNonStreamingResponse(url, payload);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.response?.data || error.message);
    }
  }

  async testResponsesAPI(message, model = 'claude-sonnet', streaming = false, reasoning = false) {
    const url = `${this.baseURL}/v1/responses`;
    
    const payload = {
      model: model,
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      stream: streaming,
      reasoning: reasoning,
      metadata: {
        session_id: this.sessionId || 'test-session-' + Date.now()
      }
    };

    console.log(chalk.blue('\n🚀 Testing Responses API'));
    console.log(chalk.gray('Endpoint:'), url);
    console.log(chalk.gray('Model:'), model);
    console.log(chalk.gray('Streaming:'), streaming);
    console.log(chalk.gray('Reasoning:'), reasoning);
    console.log(chalk.gray('Message:'), message);
    console.log(chalk.gray('Payload:'), JSON.stringify(payload, null, 2));

    try {
      if (streaming) {
        await this.handleResponsesStreamingResponse(url, payload);
      } else {
        await this.handleResponsesNonStreamingResponse(url, payload);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.response?.data || error.message);
    }
  }

  async handleNonStreamingResponse(url, payload) {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(chalk.green('\n✅ Response received:'));
    console.log(chalk.yellow('Status:'), response.status);
    console.log(chalk.yellow('Response:'));
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.choices && response.data.choices[0]) {
      console.log(chalk.cyan('\n📝 Assistant Response:'));
      console.log(response.data.choices[0].message.content);
    }

    if (response.data.usage) {
      console.log(chalk.magenta('\n📊 Token Usage:'));
      console.log(`Prompt tokens: ${response.data.usage.prompt_tokens}`);
      console.log(`Completion tokens: ${response.data.usage.completion_tokens}`);
      console.log(`Total tokens: ${response.data.usage.total_tokens}`);
    }
  }

  async handleResponsesNonStreamingResponse(url, payload) {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(chalk.green('\n✅ Response received:'));
    console.log(chalk.yellow('Status:'), response.status);
    console.log(chalk.yellow('Response:'));
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.messages && response.data.messages[0]) {
      console.log(chalk.cyan('\n📝 Assistant Response:'));
      const message = response.data.messages[0];
      if (message.content && message.content[0] && message.content[0].text) {
        console.log(message.content[0].text.value);
      }
    }

    if (response.data.usage) {
      console.log(chalk.magenta('\n📊 Token Usage:'));
      console.log(`Prompt tokens: ${response.data.usage.prompt_tokens}`);
      console.log(`Completion tokens: ${response.data.usage.completion_tokens}`);
      console.log(`Total tokens: ${response.data.usage.total_tokens}`);
    }
  }

  async handleStreamingResponse(url, payload) {
    console.log(chalk.green('\n🌊 Starting streaming response...'));
    
    let fullResponse = '';
    let tokenCount = 0;
    
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // For streaming, we need to make a POST request with axios that supports streaming
      axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }).then(response => {
        console.log(chalk.yellow('Stream Status:'), response.status);
        console.log(chalk.cyan('\n📝 Streaming Response:'));
        
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                console.log(chalk.green('\n✅ Stream completed'));
                console.log(chalk.magenta('🔢 Total response tokens:'), tokenCount);
                console.log(chalk.magenta('📄 Full response length:'), fullResponse.length);
                resolve();
                return;
              }
              
              try {
                const jsonData = JSON.parse(data);
                if (jsonData.choices && jsonData.choices[0] && jsonData.choices[0].delta) {
                  const delta = jsonData.choices[0].delta;
                  if (delta.content) {
                    process.stdout.write(chalk.white(delta.content));
                    fullResponse += delta.content;
                    tokenCount++;
                  }
                }
              } catch (e) {
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        });

        response.data.on('end', () => {
          console.log(chalk.green('\n✅ Stream ended'));
          resolve();
        });

        response.data.on('error', (error) => {
          console.error(chalk.red('\n❌ Stream error:'), error.message);
          reject(error);
        });

      }).catch(reject);
    });
  }

  async handleResponsesStreamingResponse(url, payload) {
    console.log(chalk.green('\n🌊 Starting Responses API streaming...'));
    
    let fullResponse = '';
    let reasoningContent = '';
    
    return new Promise((resolve, reject) => {
      axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }).then(response => {
        console.log(chalk.yellow('Stream Status:'), response.status);
        console.log(chalk.cyan('\n📝 Streaming Response:'));
        
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7);
              console.log(chalk.blue(`\n🔔 Event: ${eventType}`));
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                console.log(chalk.green('\n✅ Stream completed'));
                console.log(chalk.magenta('📄 Full response length:'), fullResponse.length);
                if (reasoningContent) {
                  console.log(chalk.magenta('🧠 Reasoning content length:'), reasoningContent.length);
                }
                resolve();
                return;
              }
              
              try {
                const jsonData = JSON.parse(data);
                
                // Handle different event types
                if (jsonData.type === 'response.created') {
                  console.log(chalk.green(`✅ Response created: ${jsonData.response.id}`));
                } else if (jsonData.type === 'response.output_item.added') {
                  console.log(chalk.blue(`📄 Output item added: ${jsonData.item.id}`));
                } else if (jsonData.type === 'response.output_text.delta') {
                  // Display normal text tokens
                  process.stdout.write(chalk.white(jsonData.delta));
                  fullResponse += jsonData.delta;
                } else if (jsonData.type === 'response.reasoning_summary.delta') {
                  // Display reasoning tokens
                  const reasoning = jsonData.delta;
                  if (reasoning.summary) {
                    console.log(chalk.yellow(`\n🧠 Reasoning: ${reasoning.summary}`));
                    reasoningContent += reasoning.summary + '\n';
                  }
                  if (reasoning.details) {
                    console.log(chalk.gray(`   Details: ${JSON.stringify(reasoning.details)}`));
                  }
                } else if (jsonData.type === 'response.output_item.done') {
                  console.log(chalk.green(`\n✅ Output item completed: ${jsonData.item.id}`));
                } else if (jsonData.type === 'response.completed') {
                  console.log(chalk.green(`\n🎉 Response completed: ${jsonData.response.id}`));
                  if (jsonData.response.usage) {
                    console.log(chalk.magenta('\n📊 Token Usage:'));
                    console.log(`Prompt tokens: ${jsonData.response.usage.prompt_tokens}`);
                    console.log(`Completion tokens: ${jsonData.response.usage.completion_tokens}`);
                    console.log(`Total tokens: ${jsonData.response.usage.total_tokens}`);
                  }
                } else if (jsonData.type === 'error') {
                  console.error(chalk.red(`\n❌ Error: ${jsonData.message}`));
                }
              } catch (e) {
                // Ignore parsing errors for incomplete chunks
              }
            }
          }
        });

        response.data.on('end', () => {
          console.log(chalk.green('\n✅ Stream ended'));
          resolve();
        });

        response.data.on('error', (error) => {
          console.error(chalk.red('\n❌ Stream error:'), error.message);
          reject(error);
        });

      }).catch(reject);
    });
  }

  async interactiveMode() {
    console.log(chalk.blue.bold('\n🤖 Claude Code API Test Client - Interactive Mode'));
    console.log(chalk.gray('Type "exit" to quit, "config" to change settings\n'));

    let settings = {
      baseURL: this.baseURL,
      apiKey: this.apiKey,
      model: 'claude-sonnet',
      streaming: true,
      reasoning: true,
      api: 'chat' // or 'responses'
    };

    while (true) {
      const { message } = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: 'You:',
        }
      ]);

      if (message.toLowerCase() === 'exit') {
        console.log(chalk.yellow('👋 Goodbye!'));
        break;
      }

      if (message.toLowerCase() === 'config') {
        settings = await this.configureSettings(settings);
        continue;
      }

      if (message.trim()) {
        if (settings.api === 'responses') {
          await this.testResponsesAPI(message, settings.model, settings.streaming, settings.reasoning);
        } else {
          await this.testChatCompletion(message, settings.model, settings.streaming, settings.reasoning);
        }
      }
    }
  }

  async configureSettings(currentSettings) {
    console.log(chalk.blue('\n⚙️  Configuration Settings'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseURL',
        message: 'Base URL:',
        default: currentSettings.baseURL
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'API Key:',
        default: currentSettings.apiKey
      },
      {
        type: 'list',
        name: 'model',
        message: 'Model:',
        choices: ['claude-sonnet', 'claude-4-sonnet'],
        default: currentSettings.model
      },
      {
        type: 'list',
        name: 'api',
        message: 'API Endpoint:',
        choices: [
          { name: 'Chat Completions (/v1/chat/completions)', value: 'chat' },
          { name: 'Responses API (/v1/responses)', value: 'responses' }
        ],
        default: currentSettings.api
      },
      {
        type: 'confirm',
        name: 'streaming',
        message: 'Enable streaming?',
        default: currentSettings.streaming
      },
      {
        type: 'confirm',
        name: 'reasoning',
        message: 'Enable reasoning display?',
        default: currentSettings.reasoning,
        when: (answers) => answers.api === 'responses'
      }
    ]);

    // Update client properties
    this.baseURL = answers.baseURL;
    this.apiKey = answers.apiKey;

    console.log(chalk.green('\n✅ Settings updated!'));
    return { ...currentSettings, ...answers };
  }
}

// CLI setup
const program = new Command();

program
  .name('claudecode-test-client')
  .description('CLI test client for Claude Code API')
  .version('1.0.0');

program
  .option('-u, --url <url>', 'Base URL for the API', 'http://localhost:3000')
  .option('-k, --key <key>', 'API key', 'your-api-key-here')
  .option('-m, --model <model>', 'Model to use', 'claude-sonnet')
  .option('-s, --stream', 'Enable streaming', false)
  .option('-r, --reasoning', 'Enable reasoning display (Responses API only)', false)
  .option('-a, --api <api>', 'API endpoint (chat|responses)', 'chat');

program
  .command('test')
  .description('Send a test message')
  .argument('<message>', 'Message to send')
  .action(async (message) => {
    const options = program.opts();
    const client = new ClaudeCodeAPIClient(options.url, options.key);
    
    if (options.api === 'responses') {
      await client.testResponsesAPI(message, options.model, options.stream, options.reasoning);
    } else {
      await client.testChatCompletion(message, options.model, options.stream, options.reasoning);
    }
  });

program
  .command('interactive')
  .description('Start interactive chat mode')
  .action(async () => {
    const options = program.opts();
    const client = new ClaudeCodeAPIClient(options.url, options.key);
    await client.interactiveMode();
  });

program
  .command('health')
  .description('Check API health')
  .action(async () => {
    const options = program.opts();
    try {
      const response = await axios.get(`${options.url}/health`, {
        headers: {
          'Authorization': `Bearer ${options.key}`
        }
      });
      console.log(chalk.green('✅ API is healthy'));
      console.log(response.data);
    } catch (error) {
      console.error(chalk.red('❌ API health check failed'));
      console.error(error.response?.data || error.message);
    }
  });

// If no command is provided, default to interactive mode
if (process.argv.length === 2) {
  const client = new ClaudeCodeAPIClient();
  client.interactiveMode();
} else {
  program.parse();
}