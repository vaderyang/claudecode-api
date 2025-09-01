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

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import logger from '../utils/logger';

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      logger.info('WebSocket client connected', { 
        ip: request.socket.remoteAddress,
        userAgent: request.headers['user-agent']
      });

      this.clients.add(ws);

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connected',
        data: { message: 'WebSocket connection established' },
        timestamp: new Date().toISOString()
      });

      // Handle client messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          logger.debug('WebSocket message received', { message });
          
          // Handle different message types
          this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          
          this.sendToClient(ws, {
            type: 'error',
            data: { message: 'Invalid message format' },
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error', { 
          error: error.message 
        });
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { 
        error: error.message 
      });
    });

    logger.info('WebSocket server initialized on /ws');
  }

  private handleMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;
      
      case 'subscribe':
        // Handle subscription requests (e.g., to specific data feeds)
        this.sendToClient(ws, {
          type: 'subscribed',
          data: { channel: message.channel || 'default' },
          timestamp: new Date().toISOString()
        });
        break;
      
      default:
        logger.warn('Unknown WebSocket message type', { type: message.type });
        this.sendToClient(ws, {
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` },
          timestamp: new Date().toISOString()
        });
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send WebSocket message', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  }

  // Broadcast message to all connected clients
  broadcast(message: WebSocketMessage): void {
    if (this.clients.size === 0) return;

    logger.debug('Broadcasting WebSocket message', { 
      type: message.type, 
      clientCount: this.clients.size 
    });

    this.clients.forEach((ws) => {
      this.sendToClient(ws, message);
    });
  }

  // Send message to specific client (if needed in the future)
  sendToSpecificClient(_clientId: string, message: WebSocketMessage): void {
    // Implementation would require tracking client IDs
    // For now, we'll just broadcast to all clients
    this.broadcast(message);
  }

  // Notification methods for different events
  notifyNewRequest(requestData: any): void {
    this.broadcast({
      type: 'new_request',
      data: requestData,
      timestamp: new Date().toISOString()
    });
  }

  notifyApiKeyCreated(keyData: any): void {
    this.broadcast({
      type: 'api_key_created',
      data: keyData,
      timestamp: new Date().toISOString()
    });
  }

  notifyApiKeyUpdated(keyData: any): void {
    this.broadcast({
      type: 'api_key_updated',
      data: keyData,
      timestamp: new Date().toISOString()
    });
  }

  notifyApiKeyDeleted(keyId: string): void {
    this.broadcast({
      type: 'api_key_deleted',
      data: { keyId },
      timestamp: new Date().toISOString()
    });
  }

  notifyConfigUpdate(updates: any): void {
    this.broadcast({
      type: 'config_updated',
      data: updates,
      timestamp: new Date().toISOString()
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.wss) {
      this.clients.forEach(ws => ws.close());
      this.clients.clear();
      this.wss.close();
      logger.info('WebSocket server closed');
    }
  }
}

export const webSocketService = new WebSocketService();
