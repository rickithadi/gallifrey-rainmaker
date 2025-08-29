# Gallifrey Rainmaker - Deployment Guide

This guide walks through setting up the complete Gallifrey Dual-Track Marketing Automation System from scratch.

## Prerequisites

### Required Services
- Node.js 18+ installed locally
- PostgreSQL database (local or cloud)
- Redis instance (local or cloud)
- Google Cloud Project with APIs enabled
- OpenAI API account
- Git repository access

### Google Cloud Setup
1. Create a new Google Cloud Project
2. Enable the following APIs:
   - Google Sheets API
   - Google Drive API
3. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create a new service account
   - Download the JSON key file
   - Note the email address of the service account

### External API Keys (Optional)
- Clearbit API key for company enrichment
- Hunter.io API key for email finding
- Apollo API key for contact data

## Local Development Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd gallifreyRainmaker
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/gallifrey_rainmaker
REDIS_URL=redis://localhost:6379

# Google Services
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Security
JWT_SECRET=your-secure-random-string
API_RATE_LIMIT_REQUESTS=100
```

### 3. Database Setup
Create PostgreSQL database and run migrations:
```bash
createdb gallifrey_rainmaker
npm run db:migrate
```

### 4. Google Sheets Setup
Create the master spreadsheet:
```bash
npm run sheets:setup
```

This will:
- Create a new Google Spreadsheet
- Set up all required sheets with proper structure
- Update your `.env` file with the spreadsheet ID
- Configure initial formatting and validation

### 5. Google Apps Script Deployment
```bash
# Install Google clasp CLI globally
npm install -g @google/clasp

# Login to Google account
clasp login

# Create new Apps Script project
clasp create --type sheets --title "Gallifrey Automation"

# Update .clasp.json with your script ID
# Then deploy
npm run sheets:deploy
```

### 6. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Production Deployment

### 1. Cloud Infrastructure Setup

#### Option A: Heroku Deployment
```bash
# Install Heroku CLI and login
heroku create gallifrey-rainmaker

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Add Redis addon  
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set GOOGLE_SERVICE_ACCOUNT_EMAIL=your-email@project.iam.gserviceaccount.com
heroku config:set GOOGLE_PRIVATE_KEY="your-private-key"
heroku config:set OPENAI_API_KEY=sk-your-key
heroku config:set JWT_SECRET=your-secure-secret

# Deploy
git push heroku main

# Run database migrations
heroku run npm run db:migrate
```

#### Option B: AWS/GCP Deployment
1. Set up container registry and push Docker image
2. Configure managed database services
3. Set up load balancer and SSL certificates
4. Configure environment variables in your cloud platform

### 2. Google Apps Script Production Setup
```bash
# Update BACKEND_API_URL in Code.gs to your production URL
# Then deploy to production
clasp push
```

### 3. DNS and SSL Configuration
- Point your domain to the production server
- Configure SSL certificates
- Update CORS settings in the server for your domain

## Verification and Testing

### 1. Backend Health Check
```bash
curl https://your-domain.com/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### 2. Google Sheets Integration Test
1. Open your Google Spreadsheet
2. Go to Extensions > Apps Script
3. Run the `testBackendConnection()` function
4. Should show "Backend connection successful"

### 3. End-to-End Lead Processing Test
1. Add a test lead in the "Lead Intake" sheet:
   - Company: "Test Corp"
   - Contact: "John Doe"  
   - Email: "john@testcorp.com"
2. Wait 30 seconds for auto-sync
3. Check that the lead appears in either Enterprise or SMB pipeline
4. Verify agent activity appears in recent activity log

## Monitoring and Maintenance

### 1. Log Monitoring
- Backend logs: Check server logs for errors
- Google Apps Script logs: View in Apps Script editor
- Database performance: Monitor query performance

### 2. Performance Monitoring
- API response times
- Google Sheets sync latency
- Agent processing times
- Memory and CPU usage

### 3. Regular Maintenance Tasks
- Weekly: Review agent performance metrics
- Monthly: Clean up old log data
- Quarterly: Review and optimize database indexes

## Troubleshooting

### Common Issues

#### "Google Sheets connection failed"
- Verify service account has access to the spreadsheet
- Check that Google Sheets API is enabled
- Ensure GOOGLE_PRIVATE_KEY is properly formatted with \n characters

#### "Database connection failed"
- Check DATABASE_URL format
- Verify database credentials and host accessibility
- Ensure PostgreSQL is running and accepting connections

#### "OpenAI API quota exceeded"
- Check your OpenAI account usage limits
- Consider upgrading your OpenAI plan
- Implement request throttling if needed

#### "Agents not processing leads"
- Check agent status in the control panel
- Review backend logs for agent errors
- Restart the agent coordinator service

### Debug Commands
```bash
# Test database connection
npm run test:db

# Test Google Sheets connection  
npm run test:sheets

# Test AI agent functionality
npm run test:agents

# View recent logs
npm run logs

# Reset agent state
npm run agents:reset
```

## Security Considerations

### API Security
- All API endpoints use rate limiting
- Sensitive endpoints require authentication
- Input validation on all data entry points

### Google Sheets Security
- Service account has minimal required permissions
- Spreadsheet shared only with authorized users
- Regular audit of sheet access permissions

### Data Protection
- All passwords and API keys stored as environment variables
- Database connections encrypted in production
- Regular security updates for dependencies

## Performance Optimization

### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_leads_track_status ON leads(track, status);
CREATE INDEX CONCURRENTLY idx_agent_activities_created ON agent_activities(created_at);
```

### Caching Strategy
- Redis caches frequent Google Sheets queries
- Agent context cached to reduce OpenAI API calls
- Database query results cached where appropriate

### Scaling Considerations
- Horizontal scaling: Multiple server instances behind load balancer
- Database scaling: Read replicas for reporting queries
- Agent scaling: Increase MAX_CONCURRENT_AGENTS based on load

## Backup and Recovery

### Database Backups
```bash
# Daily automated backup
pg_dump gallifrey_rainmaker > backup_$(date +%Y%m%d).sql

# Restore from backup
psql gallifrey_rainmaker < backup_20240101.sql
```

### Google Sheets Backup
- Google Sheets automatically saves revision history
- Export critical data to CSV weekly as additional backup
- Document recovery procedures for sheet corruption

### Configuration Backup
- Store environment variables in secure password manager
- Keep copies of service account keys in secure location
- Document all third-party API configurations

This deployment guide ensures a robust, scalable production setup for the Gallifrey Rainmaker system.