# Troubleshooting Guide - Claude Code API

## Overview

This guide helps diagnose and resolve common issues with the Claude Code API service.

## Root Cause Analysis - Process Exit Code 1 Issue

### Problem
The Claude Code SDK was consistently failing with "Claude Code process exited with code 1" errors, causing all API requests to fail.

### Root Cause
The issue was identified as a **Node.js/Bun compatibility problem**:
- The Claude Code SDK by default uses Bun as the JavaScript runtime executor
- There was a JavaScript TypeError in the events handling code when run with Bun
- The error occurred specifically at `node:events:102:30` in the CLI code

### Solution
**Force the SDK to use Node.js instead of Bun** by explicitly setting the `executable` and `executableArgs` options:

```typescript
const options = {
  cwd: publicDir,
  permissionMode: 'bypassPermissions',
  // Force using Node.js instead of Bun to avoid compatibility issues
  executable: 'node',
  executableArgs: []
};
```

## Common Issues and Solutions

### 1. Claude Code Process Exit Code 1

**Symptoms:**
- All API requests fail with 500 status
- Logs show "Claude Code process exited with code 1"
- Error occurs immediately after SDK initialization

**Solution:**
- Ensure the service is configured to use Node.js executable
- Check that the fix in `claudeCodeService.ts` is applied
- Verify Node.js version compatibility (tested with Node.js v23.11.0)

**Verification:**
```bash
# Test the SDK directly
node -e "
import { query } from '@anthropic-ai/claude-code';
const iterator = query({
  prompt: 'hello',
  options: { executable: 'node', executableArgs: [] }
});
console.log('SDK working if this runs without error');
"
```

### 2. Service Won't Start

**Symptoms:**
- Service fails to build or start
- TypeScript compilation errors

**Solution:**
```bash
# Clean and rebuild
rm -rf dist/
npm run build
npm start
```

**Check dependencies:**
```bash
npm audit
npm install
```

### 3. Authentication Issues

**Symptoms:**
- 401 Unauthorized responses
- Authentication middleware errors

**Solution:**
- Claude Code SDK handles authentication internally
- No API keys required for basic operation
- Ensure `OPENAI_API_KEY_REQUIRED=false` in environment

### 4. File Operation Detection Issues

**Symptoms:**
- Created/modified files not returned in API responses
- File operations not logged properly

**Solution:**
- The service uses multiple detection methods:
  1. Tool usage analysis from Claude Code messages
  2. Directory snapshot comparison before/after
- Check that the `public/` directory is writable
- Verify file permissions

### 5. Performance Issues

**Symptoms:**
- Slow API responses
- Timeout errors

**Solution:**
- The service includes retry logic with exponential backoff
- Monitor logs for retry attempts
- Check system resources (CPU, memory)
- Consider adjusting timeout values

## Debugging Steps

### Enable Debug Logging

Set environment variable:
```bash
DEBUG=true npm start
```

Or in code:
```typescript
process.env.DEBUG = 'true';
process.env.DEBUG_SDK = 'true';
```

### Check Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "claude_code": "operational"
  }
}
```

### Test Simple Request

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

### Monitor Logs

Key log entries to watch for:
- `Claude Code service initialized` - SDK setup successful
- `Claude Code SDK query completed` - Request processed successfully
- `Error processing Claude Code request` - Request failed

## Performance Monitoring

### Key Metrics to Monitor

1. **Request Success Rate**
   - Track successful vs failed requests
   - Monitor error patterns

2. **Response Times**
   - Average processing time
   - 95th percentile response times

3. **Resource Usage**
   - Memory consumption
   - CPU usage
   - File system operations

4. **SDK Health**
   - Process spawn success rate
   - Claude Code process lifecycle

### Log Analysis

Important log patterns:
```
✅ SUCCESS: "Claude Code execution successful"
❌ ERROR: "Claude Code process exited with code 1"
⚠️  RETRY: "Retrying Claude Code query"
```

## Environment Requirements

### Node.js Version
- **Tested:** Node.js v23.11.0
- **Minimum:** Node.js v18.x recommended

### Dependencies
- `@anthropic-ai/claude-code@^1.0.89`
- All dependencies listed in `package.json`

### System Requirements
- Write access to `public/` directory
- Sufficient memory for Claude Code processes
- Network access for Claude API calls

## Configuration Best Practices

### Production Environment
```env
NODE_ENV=production
LOG_LEVEL=info
OPENAI_API_KEY_REQUIRED=false
PORT=3000
```

### Development Environment
```env
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=true
```

### Docker Considerations
When running in Docker:
- Ensure Node.js is available in the container
- Mount the `public/` directory as writable
- Set proper user permissions

## Recovery Procedures

### Service Recovery
1. **Immediate:** Restart the service
2. **Investigate:** Check logs for error patterns
3. **Verify:** Test with simple health check
4. **Monitor:** Watch for recurring issues

### Data Recovery
- File operations are isolated to `public/` directory
- No persistent data storage for sessions
- Restart clears in-memory session data

## Support and Contact

For additional support:
1. Check the logs with debug logging enabled
2. Verify the troubleshooting steps above
3. Review the GitHub repository for known issues
4. Create an issue with detailed error logs

## Version History

- **v1.0.0:** Initial release with Bun compatibility fix
- **Date:** 2025-08-25
- **Fix:** Forced Node.js executable usage in SDK configuration
