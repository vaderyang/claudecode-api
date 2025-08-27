# Claude Code Authentication Refresh System

## Overview

The Claude Code API now includes a comprehensive authentication refresh system that automatically handles expired authentication tokens and ensures uninterrupted service. This system monitors authentication status, detects authentication errors, and automatically refreshes credentials when needed.

## Features

- ✅ **Automatic Authentication Detection**: Identifies authentication-related errors using pattern matching
- ✅ **Smart Retry Logic**: Implements cooldown periods and consecutive failure limits
- ✅ **Transparent Recovery**: Automatically retries failed requests after successful refresh
- ✅ **Comprehensive Logging**: Detailed logging for monitoring and troubleshooting
- ✅ **Health Monitoring**: Authentication status included in health checks
- ✅ **Manual Refresh**: Administrative endpoints for manual authentication refresh

## How It Works

### 1. Error Detection

The system monitors all Claude Code SDK operations and uses pattern matching to detect authentication errors:

```typescript
const authErrorPatterns = [
  'authentication', 'auth', 'unauthorized', 'invalid.*key', 'invalid.*token',
  'api.*key', 'token.*expired', 'session.*expired', 'permission.*denied',
  'access.*denied', 'forbidden', '401', '403', 'apikey', 'credential'
];
```

### 2. Automatic Refresh Process

When an authentication error is detected:

1. **Validation**: Check if retry is advisable (cooldown period, consecutive failures)
2. **Refresh Attempt**: Try to refresh authentication using multiple strategies
3. **Retry Operation**: If refresh succeeds, automatically retry the original request
4. **Failure Handling**: Log failures and update status for monitoring

### 3. Refresh Strategies

The system employs multiple strategies to refresh authentication:

#### Strategy 1: SDK Test Query
- Sends a minimal test query to the Claude Code SDK
- Validates authentication through system message responses
- Detects authentication errors in real-time

#### Strategy 2: Module Cache Clearing
- Clears the Node.js require cache for the Claude Code module
- Forces re-import to trigger authentication re-initialization
- Provides a fallback when primary strategy fails

## Configuration

### Default Settings

```typescript
private readonly maxConsecutiveFailures = 3;      // Max failures before giving up
private readonly refreshCooldownMs = 30000;       // 30 seconds between attempts
private readonly authTimeoutMs = 5 * 60 * 1000;   // 5 minutes for auth operations
```

### Environment Variables

No additional environment variables are required. The system uses the existing Claude Code SDK configuration.

## API Endpoints

### Authentication Status

**GET** `/health/auth`

Returns current authentication status:

```json
{
  "status": "authenticated",
  "timestamp": "2025-08-24T03:53:28Z",
  "authentication": {
    "isAuthenticated": true,
    "lastRefresh": "2025-08-24T03:50:15Z",
    "refreshCount": 2,
    "consecutiveFailures": 0
  }
}
```

### Manual Refresh

**POST** `/health/auth/refresh`

Manually triggers an authentication refresh:

```json
{
  "status": "refreshed",
  "timestamp": "2025-08-24T03:53:28Z",
  "result": {
    "success": true,
    "message": "Authentication refreshed successfully",
    "shouldRetry": true
  },
  "authentication": {
    "isAuthenticated": true,
    "lastRefresh": "2025-08-24T03:53:28Z",
    "refreshCount": 3,
    "consecutiveFailures": 0
  }
}
```

### Health Check Integration

The main health endpoint (`GET /health`) now includes authentication status:

```json
{
  "status": "healthy",
  "timestamp": "2025-08-24T03:53:28Z",
  "authentication": {
    "isAuthenticated": true,
    "lastRefresh": "2025-08-24T03:50:15Z",
    "refreshCount": 2,
    "consecutiveFailures": 0
  }
}
```

## Implementation Details

### Service Integration

Both streaming and non-streaming requests are protected:

```typescript
// Non-streaming requests
async processRequest(request: ClaudeCodeRequest): Promise<ClaudeCodeResponse> {
  return await authManager.handleAuthError(async () => {
    // ... Claude Code SDK operation
  }, `processRequest for session ${request.sessionId}`);
}

// Streaming requests use custom wrapper
async *processStreamRequest(request: ClaudeCodeRequest): AsyncGenerator<...> {
  try {
    yield* await this.processStreamRequestWithAuth(request, enableReasoning);
  } catch (error) {
    if (authManager.isAuthenticationError(error)) {
      // Handle authentication error and retry
    }
  }
}
```

### Error Handling Flow

1. **Operation Execution**: Normal Claude Code SDK operation
2. **Error Detection**: Check if error matches authentication patterns
3. **Retry Validation**: Verify retry is advisable (cooldown, failure limits)
4. **Refresh Attempt**: Execute authentication refresh strategies
5. **Retry Operation**: Re-execute original operation if refresh succeeds
6. **Status Update**: Update authentication status and metrics

## Monitoring and Logging

### Log Levels

- **INFO**: Successful refreshes, retry attempts
- **WARN**: Authentication errors detected, retry decisions
- **ERROR**: Refresh failures, consecutive failure limits reached
- **DEBUG**: Detailed authentication test results, cooldown decisions

### Key Metrics

- `refreshCount`: Total number of refresh attempts
- `consecutiveFailures`: Current streak of failed refresh attempts
- `lastRefresh`: Timestamp of last refresh attempt
- `isAuthenticated`: Current authentication status

### Example Logs

```
INFO: Authentication error detected in processRequest for session abc123, attempting refresh
INFO: Claude Code authentication refresh successful (refreshCount: 3, timeTaken: 1250ms)
INFO: Authentication refreshed, retrying processRequest for session abc123
WARN: Too many consecutive auth failures, not retrying (consecutiveFailures: 3, maxAllowed: 3)
```

## Testing

### Automated Testing

Run the authentication test script:

```bash
# Start the server
npm run dev

# In another terminal
./test-auth-refresh.js
```

### Manual Testing

1. **Check Status**: `GET /health/auth`
2. **Trigger Refresh**: `POST /health/auth/refresh`
3. **Monitor Logs**: Watch for authentication-related log entries
4. **Test Recovery**: Make requests during simulated authentication failures

## Best Practices

### For Developers

1. **Monitor Health Endpoints**: Regularly check `/health/auth` for authentication status
2. **Review Logs**: Monitor authentication-related log entries for patterns
3. **Handle Graceful Degradation**: Implement fallbacks for sustained authentication failures
4. **Test Edge Cases**: Verify behavior during network issues, token expiration scenarios

### For Operations

1. **Set Up Monitoring**: Alert on consecutive authentication failures
2. **Log Aggregation**: Collect authentication logs for trend analysis
3. **Health Checks**: Include authentication status in monitoring dashboards
4. **Manual Intervention**: Use manual refresh endpoint for troubleshooting

## Troubleshooting

### Common Issues

**High Consecutive Failures**
- Check Claude Code SDK configuration
- Verify network connectivity
- Review authentication credentials

**Refresh Timeouts**
- Check system resources (CPU, memory)
- Verify Claude Code SDK responsiveness
- Review timeout configuration

**Frequent Refreshes**
- Investigate root cause of authentication issues
- Check for token expiration patterns
- Review authentication configuration

### Debugging Steps

1. **Check Authentication Status**: `GET /health/auth`
2. **Review Recent Logs**: Look for authentication-related errors
3. **Manual Refresh**: `POST /health/auth/refresh`
4. **Test Basic Operation**: Make simple chat completion request
5. **Monitor Metrics**: Track refresh frequency and success rate

## Security Considerations

- Authentication refresh operations are logged but credentials are never exposed
- Failed refresh attempts are rate-limited to prevent abuse
- Authentication status is available only through authenticated endpoints
- The system maintains authentication state in memory only (no persistent storage)

## Future Enhancements

- **Proactive Refresh**: Refresh authentication before expiration
- **Enhanced Metrics**: More detailed authentication analytics
- **Custom Refresh Strategies**: Pluggable refresh mechanisms
- **Distributed State**: Shared authentication state across multiple instances
