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

import logger from '../utils/logger';
import { ClaudeCodeError } from '../utils/errors';

export interface AuthStatus {
  isAuthenticated: boolean;
  lastRefresh: Date | null;
  refreshCount: number;
  consecutiveFailures: number;
}

export interface AuthRefreshResult {
  success: boolean;
  message: string;
  shouldRetry: boolean;
}

/**
 * Manages Claude Code authentication and automatic token refresh
 */
class ClaudeCodeAuthManager {
  private authStatus: AuthStatus = {
    isAuthenticated: true, // Start optimistic since Claude Code handles its own auth
    lastRefresh: null,
    refreshCount: 0,
    consecutiveFailures: 0
  };

  private refreshInProgress = false;
  private readonly maxConsecutiveFailures = 3;
  private readonly refreshCooldownMs = 30000; // 30 seconds between refresh attempts
  private readonly authTimeoutMs = 5 * 60 * 1000; // 5 minutes for auth operations

  /**
   * Checks if an error indicates authentication issues
   */
  public isAuthenticationError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorString = error.toString?.()?.toLowerCase() || '';
    
    // Common authentication error patterns
    const authErrorPatterns = [
      'authentication',
      'auth',
      'unauthorized',
      'invalid.*key',
      'invalid.*token',
      'api.*key',
      'token.*expired',
      'session.*expired',
      'permission.*denied',
      'access.*denied',
      'forbidden',
      '401',
      '403',
      'apikey',
      'credential'
    ];

    return authErrorPatterns.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(errorMessage) || regex.test(errorString);
    });
  }

  /**
   * Checks if an error indicates the request should be retried
   */
  public shouldRetryRequest(error: any): boolean {
    if (!this.isAuthenticationError(error)) return false;
    
    // Don't retry if we've had too many consecutive failures
    if (this.authStatus.consecutiveFailures >= this.maxConsecutiveFailures) {
      logger.warn('Too many consecutive auth failures, not retrying', {
        consecutiveFailures: this.authStatus.consecutiveFailures,
        maxAllowed: this.maxConsecutiveFailures
      });
      return false;
    }

    // Don't retry if we just attempted a refresh recently
    if (this.authStatus.lastRefresh) {
      const timeSinceRefresh = Date.now() - this.authStatus.lastRefresh.getTime();
      if (timeSinceRefresh < this.refreshCooldownMs) {
        logger.debug('Recent refresh attempt, not retrying yet', {
          timeSinceRefresh,
          cooldownMs: this.refreshCooldownMs
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Attempts to refresh Claude Code authentication
   */
  public async refreshAuthentication(): Promise<AuthRefreshResult> {
    if (this.refreshInProgress) {
      logger.debug('Auth refresh already in progress, waiting...');
      
      // Wait for ongoing refresh to complete
      const startWait = Date.now();
      while (this.refreshInProgress && (Date.now() - startWait) < this.authTimeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (this.refreshInProgress) {
        logger.error('Auth refresh timeout while waiting for ongoing refresh');
        return {
          success: false,
          message: 'Authentication refresh timeout',
          shouldRetry: false
        };
      }
      
      // Return the result of the completed refresh
      return {
        success: this.authStatus.isAuthenticated,
        message: this.authStatus.isAuthenticated ? 'Auth refresh completed by another process' : 'Auth refresh failed in another process',
        shouldRetry: !this.authStatus.isAuthenticated && this.authStatus.consecutiveFailures < this.maxConsecutiveFailures
      };
    }

    this.refreshInProgress = true;
    const refreshStartTime = Date.now();

    try {
      logger.info('Starting Claude Code authentication refresh', {
        currentStatus: this.authStatus,
        timestamp: new Date().toISOString()
      });

      // Since Claude Code SDK handles its own authentication internally,
      // we need to trigger a refresh through various strategies
      const refreshResult = await this.performAuthenticationRefresh();
      
      if (refreshResult.success) {
        this.authStatus = {
          isAuthenticated: true,
          lastRefresh: new Date(),
          refreshCount: this.authStatus.refreshCount + 1,
          consecutiveFailures: 0
        };

        logger.info('Claude Code authentication refresh successful', {
          refreshCount: this.authStatus.refreshCount,
          timeTaken: Date.now() - refreshStartTime
        });

        return {
          success: true,
          message: 'Authentication refreshed successfully',
          shouldRetry: true
        };
      } else {
        this.authStatus.consecutiveFailures++;
        this.authStatus.isAuthenticated = false;
        this.authStatus.lastRefresh = new Date();

        logger.error('Claude Code authentication refresh failed', {
          consecutiveFailures: this.authStatus.consecutiveFailures,
          maxAllowed: this.maxConsecutiveFailures,
          message: refreshResult.message
        });

        return {
          success: false,
          message: refreshResult.message,
          shouldRetry: this.authStatus.consecutiveFailures < this.maxConsecutiveFailures
        };
      }
    } catch (error) {
      this.authStatus.consecutiveFailures++;
      this.authStatus.isAuthenticated = false;
      this.authStatus.lastRefresh = new Date();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error during auth refresh';
      
      logger.error('Exception during Claude Code authentication refresh', {
        error: errorMessage,
        consecutiveFailures: this.authStatus.consecutiveFailures,
        timeTaken: Date.now() - refreshStartTime
      });

      return {
        success: false,
        message: `Auth refresh exception: ${errorMessage}`,
        shouldRetry: this.authStatus.consecutiveFailures < this.maxConsecutiveFailures
      };
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Performs the actual authentication refresh
   */
  private async performAuthenticationRefresh(): Promise<{ success: boolean; message: string }> {
    try {
      // Strategy 1: Try to get system information from Claude Code SDK
      // This will trigger internal authentication validation
      const testQuery = { 
        prompt: "Hello", 
        options: { 
          cwd: process.cwd(),
          permissionMode: 'bypassPermissions' as any
        } 
      };

      // Import the query function dynamically to test authentication
      const { query } = await import('@anthropic-ai/claude-code');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Authentication test timeout')), this.authTimeoutMs);
      });

      // Test authentication with a simple query
      const testPromise = (async () => {
        try {
          for await (const message of query(testQuery)) {
            if (message.type === 'system') {
              logger.debug('Claude Code authentication test - system message received', {
                subtype: 'subtype' in message ? message.subtype : 'unknown',
                hasApiKeySource: 'apiKeySource' in message
              });
              
              // If we get a system message, authentication is working
              return { success: true, message: 'Authentication validated via system message' };
            }
            
            if (message.type === 'result') {
              if (message.subtype === 'error_during_execution' || message.subtype === 'error_max_turns') {
                // Check if the error is authentication-related
                if (this.isAuthenticationError(message)) {
                  throw new Error(`Authentication error: ${message.subtype}`);
                }
              }
              
              // Any result message indicates successful authentication
              return { success: true, message: 'Authentication validated via result message' };
            }
            
            // Break after first meaningful message to avoid long execution
            if (message.type === 'assistant' || message.type === 'user') {
              return { success: true, message: 'Authentication validated via message response' };
            }
          }
        } catch (error: any) {
          if (this.isAuthenticationError(error)) {
            throw error;
          }
          // Non-auth errors still indicate successful authentication
          return { success: true, message: 'Authentication validated (non-auth error during test)' };
        }
        
        return { success: false, message: 'No response from Claude Code SDK' };
      })();

      const result = await Promise.race([testPromise, timeoutPromise]);
      return result as { success: boolean; message: string };

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      
      if (this.isAuthenticationError(error)) {
        // Try additional refresh strategies for authentication errors
        return await this.attemptAlternativeRefresh(errorMessage);
      }

      // If it's not an auth error, consider the auth working but the test failed
      logger.debug('Non-authentication error during auth test, considering auth valid', {
        error: errorMessage
      });
      
      return { 
        success: true, 
        message: 'Authentication likely valid (non-auth error during validation)' 
      };
    }
  }

  /**
   * Attempts alternative authentication refresh strategies
   */
  private async attemptAlternativeRefresh(originalError: string): Promise<{ success: boolean; message: string }> {
    logger.info('Attempting alternative authentication refresh strategies', {
      originalError
    });

    // Strategy 2: Check for authentication configuration files and trigger re-read
    try {
      // Clear any cached authentication state by reimporting
      delete require.cache[require.resolve('@anthropic-ai/claude-code')];
      
      // Wait a bit for any internal cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try importing again to trigger re-authentication
      await import('@anthropic-ai/claude-code');
      
      logger.debug('Re-imported Claude Code SDK for auth refresh');
      
      return { 
        success: true, 
        message: 'Authentication refresh attempted via SDK re-import' 
      };
      
    } catch (error: any) {
      logger.debug('Alternative refresh strategy failed', {
        error: error.message
      });
      
      return { 
        success: false, 
        message: `Alternative refresh failed: ${error.message}` 
      };
    }
  }

  /**
   * Gets current authentication status
   */
  public getAuthStatus(): AuthStatus {
    return { ...this.authStatus };
  }

  /**
   * Resets authentication status (useful for testing)
   */
  public resetAuthStatus(): void {
    this.authStatus = {
      isAuthenticated: true,
      lastRefresh: null,
      refreshCount: 0,
      consecutiveFailures: 0
    };
    this.refreshInProgress = false;
    
    logger.info('Claude Code authentication status reset');
  }

  /**
   * Handles authentication errors with automatic retry logic
   */
  public async handleAuthError<T>(
    operation: () => Promise<T>, 
    context: string = 'Claude Code operation'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isAuthenticationError(error)) {
        throw error;
      }

      logger.warn(`Authentication error detected in ${context}, attempting refresh`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        consecutiveFailures: this.authStatus.consecutiveFailures
      });

      if (!this.shouldRetryRequest(error)) {
        throw new ClaudeCodeError(`Authentication failed and retry not advisable: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Attempt authentication refresh
      const refreshResult = await this.refreshAuthentication();
      
      if (!refreshResult.success) {
        throw new ClaudeCodeError(`Authentication refresh failed: ${refreshResult.message}`);
      }

      // Retry the operation once after successful refresh
      logger.info(`Authentication refreshed, retrying ${context}`);
      
      try {
        return await operation();
      } catch (retryError) {
        logger.error(`Operation failed even after authentication refresh in ${context}`, {
          error: retryError instanceof Error ? retryError.message : 'Unknown error'
        });
        throw retryError;
      }
    }
  }
}

export default new ClaudeCodeAuthManager();
