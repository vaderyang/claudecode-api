/**
 * MIT License
 * 
 * Copyright (c) 2025 Claude Code API
 * Original repository: https://github.com/vaderyang/claudecode-api
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

import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Claude Code API',
    version: '1.0.0',
    description: 'OpenAI-compatible API providing access to Claude Code\'s advanced coding capabilities through the Claude Code SDK',
    contact: {
      name: 'Claude Code API Support',
      url: 'https://github.com/vaderyang/claudecode-api'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'Enter your API key'
      }
    },
    schemas: {
      ChatMessage: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: {
            type: 'string',
            enum: ['system', 'user', 'assistant'],
            description: 'The role of the message author'
          },
          content: {
            type: 'string',
            description: 'The content of the message'
          }
        },
        example: {
          role: 'user',
          content: 'Write a Python function to implement a binary search algorithm'
        }
      },
      ChatCompletionRequest: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
          model: {
            type: 'string',
            description: 'The model to use for completion',
            example: 'claudecode-v1'
          },
          messages: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ChatMessage'
            },
            description: 'The messages to generate chat completions for'
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
            default: 1,
            description: 'Controls randomness in the output'
          },
          max_tokens: {
            type: 'integer',
            minimum: 1,
            description: 'The maximum number of tokens to generate'
          },
          top_p: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 1,
            description: 'Controls diversity via nucleus sampling'
          },
          frequency_penalty: {
            type: 'number',
            minimum: -2,
            maximum: 2,
            default: 0,
            description: 'Decreases likelihood of repetition based on frequency'
          },
          presence_penalty: {
            type: 'number',
            minimum: -2,
            maximum: 2,
            default: 0,
            description: 'Decreases likelihood of repetition based on presence'
          },
          stop: {
            oneOf: [
              {
                type: 'string'
              },
              {
                type: 'array',
                items: {
                  type: 'string'
                },
                maxItems: 4
              }
            ],
            description: 'Sequences where the API will stop generating tokens'
          },
          stream: {
            type: 'boolean',
            default: false,
            description: 'Whether to stream the response'
          },
          user: {
            type: 'string',
            description: 'A unique identifier representing your end-user'
          }
        }
      },
      ChatCompletionResponse: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'A unique identifier for the chat completion'
          },
          object: {
            type: 'string',
            enum: ['chat.completion']
          },
          created: {
            type: 'integer',
            description: 'The Unix timestamp of when the chat completion was created'
          },
          model: {
            type: 'string',
            description: 'The model used for the chat completion'
          },
          choices: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ChatCompletionChoice'
            }
          },
          usage: {
            $ref: '#/components/schemas/Usage'
          }
        }
      },
      ChatCompletionChoice: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            description: 'The index of the choice in the list of choices'
          },
          message: {
            $ref: '#/components/schemas/ChatMessage'
          },
          finish_reason: {
            type: 'string',
            enum: ['stop', 'length', 'function_call', 'content_filter'],
            description: 'The reason the model stopped generating tokens'
          }
        }
      },
      Usage: {
        type: 'object',
        properties: {
          prompt_tokens: {
            type: 'integer',
            description: 'Number of tokens in the prompt'
          },
          completion_tokens: {
            type: 'integer',
            description: 'Number of tokens in the generated completion'
          },
          total_tokens: {
            type: 'integer',
            description: 'Total number of tokens used in the request'
          }
        }
      },
      Model: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The model identifier'
          },
          object: {
            type: 'string',
            enum: ['model']
          },
          created: {
            type: 'integer',
            description: 'The Unix timestamp of when the model was created'
          },
          owned_by: {
            type: 'string',
            description: 'The organization that owns the model'
          },
          permission: {
            type: 'array',
            items: {
              type: 'object'
            },
            description: 'The permissions associated with the model'
          },
          root: {
            type: 'string',
            description: 'The root model identifier'
          },
          parent: {
            type: 'string',
            nullable: true,
            description: 'The parent model identifier'
          }
        }
      },
      ModelsResponse: {
        type: 'object',
        properties: {
          object: {
            type: 'string',
            enum: ['list']
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Model'
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'A human-readable error message'
              },
              type: {
                type: 'string',
                description: 'The type of error'
              },
              param: {
                type: 'string',
                description: 'The parameter that caused the error'
              },
              code: {
                type: 'string',
                description: 'The error code'
              }
            },
            required: ['message', 'type']
          }
        }
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy'],
            description: 'The health status of the API'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'The timestamp when the health check was performed'
          },
          version: {
            type: 'string',
            description: 'The API version'
          },
          uptime: {
            type: 'number',
            description: 'The uptime in seconds'
          }
        }
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ]
};

const options: swaggerJSDoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/controllers/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJSDoc(options);
