# Claude Code API - Web Management Interface

A comprehensive web-based management interface for the Claude Code API, providing real-time monitoring, API key management, request logging, analytics, and system configuration.

## Features

### 🔐 **Authentication & Security**
- Secure login system with bcrypt password hashing
- Session-based authentication with configurable expiry
- Role-based access control (Admin/Viewer roles)
- Rate limiting on authentication attempts
- CSRF protection for all forms

### 📊 **Dashboard & Analytics**
- Real-time system overview with key metrics
- Interactive charts powered by Chart.js:
  - API usage over time
  - Response time distribution
  - Error rate trends  
  - Request distribution by model
- Recent activity feed
- System health indicators

### 🔑 **API Key Management**
- Create, edit, and delete API keys
- Configurable rate limits per key
- Key expiration dates
- Usage tracking and statistics
- Secure key generation with cryptographic randomness
- Key masking in list views for security

### 📋 **Request/Response Logging**
- Comprehensive request logging to SQLite database
- Advanced filtering capabilities:
  - Date range selection
  - HTTP status codes
  - API endpoints
  - Specific API keys
- Detailed request/response inspection
- Real-time log streaming via WebSocket
- Pagination for large datasets

### ⚙️ **System Configuration**
- Live configuration management
- Environment variable viewing
- CORS origin configuration
- Log level adjustment
- API key requirement toggle
- System information display (uptime, memory usage)

### 🚀 **Real-time Updates**
- WebSocket integration for live data updates
- Real-time notification system
- Auto-refreshing dashboard metrics
- Live activity monitoring

## Architecture

```
src/webui/
├── auth.ts              # Authentication middleware & services
├── controllers.ts       # RESTful API endpoints for WebUI
├── database.ts          # SQLite database service & schema
└── logging.ts           # Request logging middleware

webui/public/
├── index.html           # Main SPA template with Tailwind CSS
└── app.js               # Frontend JavaScript application
```

## Database Schema

The WebUI uses SQLite with the following tables:

### API Keys (`api_keys`)
- `id` - Unique identifier
- `key` - The actual API key (stored securely)
- `name` - Human-readable name
- `created_at` - Creation timestamp
- `expires_at` - Optional expiration date
- `is_active` - Active/inactive status
- `permissions` - JSON permissions object
- `rate_limit` - Requests per minute limit
- `description` - Optional description
- `last_used` - Last usage timestamp
- `usage_count` - Total number of requests

### Request Logs (`request_logs`)
- `id` - Unique identifier
- `timestamp` - Request timestamp
- `api_key_id` - Associated API key (if any)
- `endpoint` - Requested endpoint
- `method` - HTTP method
- `model` - AI model used (if applicable)
- `status_code` - HTTP response code
- `request_body` - Request payload (truncated)
- `response_body` - Response payload (truncated)
- `response_time` - Response time in milliseconds
- `tokens_used` - Token consumption
- `ip_address` - Client IP address
- `user_agent` - Client user agent
- `error_message` - Error details (if any)

### Analytics (`analytics`)
- `id` - Unique identifier
- `date` - Date in YYYY-MM-DD format
- `metric_type` - Type of metric (requests, errors, tokens, etc.)
- `metric_value` - Numeric value
- `metadata` - Additional JSON metadata

### WebUI Users (`webui_users`)
- `id` - Unique identifier
- `username` - Login username
- `password_hash` - bcrypt hashed password
- `created_at` - Account creation date
- `last_login` - Last login timestamp
- `is_active` - Active/inactive status
- `role` - User role (admin/viewer)

## Installation & Setup

### 1. Dependencies
All dependencies are already included in the main project's `package.json`. The WebUI uses:
- **Backend**: Express.js, SQLite3, bcrypt, express-session, WebSocket
- **Frontend**: Vanilla JavaScript, Tailwind CSS (CDN), Chart.js (CDN), Prism.js (CDN)

### 2. Environment Configuration
Add these variables to your `.env` file:

```env
# WebUI Configuration
SESSION_SECRET=your-secure-session-secret-here
WEBUI_DEFAULT_PASSWORD=admin123
```

### 3. Database Initialization
The database is automatically initialized on first startup. A default admin user is created:
- **Username**: `admin`
- **Password**: `admin123` (or value from `WEBUI_DEFAULT_PASSWORD`)

### 4. Access the Interface
Once the server is running, access the WebUI at:
```
http://localhost:3000/webui
```

## API Endpoints

### Authentication
- `POST /api/webui/auth/login` - User login
- `POST /api/webui/auth/logout` - User logout  
- `GET /api/webui/auth/me` - Get current user info

### API Key Management
- `GET /api/webui/keys` - List all API keys
- `POST /api/webui/keys` - Create new API key
- `PUT /api/webui/keys/:id` - Update API key
- `DELETE /api/webui/keys/:id` - Delete API key

### Request Logs
- `GET /api/webui/logs` - Get request logs with filtering
- Parameters: `page`, `limit`, `startDate`, `endDate`, `apiKeyId`, `endpoint`, `statusCode`

### Analytics
- `GET /api/webui/analytics` - Get analytics data
- `GET /api/webui/analytics/realtime` - Get real-time dashboard stats
- Parameters: `startDate`, `endDate`, `metricTypes`

### System Management
- `GET /api/webui/config` - Get system configuration
- `PUT /api/webui/config` - Update configuration (admin only)
- `GET /api/webui/health` - System health status

## Security Features

### Authentication Security
- **Password Hashing**: bcrypt with 12 salt rounds
- **Session Management**: Secure HTTP-only cookies
- **Rate Limiting**: 5 attempts per 15-minute window per IP
- **Session Expiry**: 24-hour configurable timeout

### Data Protection
- **Input Sanitization**: All user inputs are sanitized
- **SQL Injection Prevention**: Prepared statements throughout
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: Built-in Express CSRF middleware

### Access Control
- **Role-based permissions**: Admin vs Viewer roles
- **Route protection**: Authentication required for all WebUI routes
- **Admin-only features**: Configuration management restricted
- **API key masking**: Keys partially hidden in list views

## Performance Optimizations

### Database
- **Indexes**: Optimized indexes on frequently queried columns
- **Query optimization**: Efficient pagination and filtering
- **Connection pooling**: Reused database connections
- **Prepared statements**: Better query performance and security

### Frontend
- **Lazy loading**: Charts and data loaded on demand
- **Caching**: Client-side caching of frequently accessed data
- **Compression**: Gzip compression for API responses
- **Minimal dependencies**: CDN-based assets, no build process required

### Real-time Features
- **WebSocket connections**: Efficient real-time updates
- **Selective updates**: Only refresh affected components
- **Connection management**: Automatic reconnection handling

## Monitoring & Logging

### Application Logs
- **Structured logging**: JSON format with Winston
- **Log levels**: Debug, Info, Warning, Error
- **File rotation**: Automatic log file management
- **Performance metrics**: Response times and resource usage

### Database Logging
- **Request tracking**: All API requests logged to database
- **Performance monitoring**: Response time tracking
- **Error tracking**: Detailed error logging and analysis
- **Analytics aggregation**: Daily/hourly metric rollups

### Health Monitoring
- **System metrics**: Memory usage, uptime tracking
- **Error rates**: Real-time error rate calculation
- **Performance alerts**: Configurable thresholds
- **Service status**: Component health checking

## Customization

### Styling
The interface uses Tailwind CSS for styling. To customize:
1. Modify the Tailwind classes in `index.html`
2. Add custom CSS in the `<style>` section
3. Update color schemes and typography as needed

### Charts & Visualizations
Charts are powered by Chart.js. To customize:
1. Modify chart configurations in `app.js`
2. Add new chart types and data sources
3. Customize colors, animations, and interactions

### Dashboard Widgets
To add new dashboard widgets:
1. Create new API endpoints in `controllers.ts`
2. Add database queries in `database.ts`
3. Update frontend rendering in `app.js`

## Development

### Adding New Features
1. **Backend**: Add new routes to `controllers.ts`
2. **Database**: Update schema in `database.ts`
3. **Frontend**: Add UI components to `app.js`
4. **Integration**: Test full stack functionality

### Testing
```bash
# Run the development server
npm run dev

# Test API endpoints
curl -X POST http://localhost:3000/api/webui/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### Debugging
- **Backend logs**: Check Winston logs in `logs/` directory
- **Database**: Use SQLite browser to inspect data
- **Frontend**: Use browser developer tools
- **Network**: Monitor WebSocket connections and API calls

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Ensure `data/` directory exists and is writable
- Check SQLite file permissions
- Verify database initialization completed

**Authentication Problems**
- Clear browser cookies and sessions
- Check session secret configuration
- Verify user exists in database

**Performance Issues**
- Monitor database query performance
- Check memory usage and cleanup
- Optimize chart rendering and data loading

**WebSocket Connection Issues**
- Verify WebSocket endpoint configuration
- Check firewall and proxy settings
- Monitor connection lifecycle in browser

### Debug Mode
Set `LOG_LEVEL=debug` for verbose logging:
```env
LOG_LEVEL=debug
```

This will log:
- Database operations
- Authentication attempts
- WebSocket events
- Performance metrics

## Contributing

When contributing to the WebUI:

1. **Follow existing patterns**: Maintain consistency with current architecture
2. **Update documentation**: Keep README and inline comments current
3. **Test thoroughly**: Verify both frontend and backend functionality
4. **Security first**: Always consider security implications
5. **Performance aware**: Monitor impact on database and memory usage

## License

MIT License - Same as the main Claude Code API project.
