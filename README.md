# Gallifrey Dual-Track Marketing Automation System

An AI-powered marketing automation system that manages two distinct customer acquisition strategies through Google Sheets as the primary frontend interface.

## System Overview

### Dual-Track Strategy
- **Enterprise B2B Track**: Gallifrey Consulting brand - high-value, long-cycle prospects
- **SMB/Creator Track**: "Own Your Narrative" campaign - volume-based, quick-conversion prospects

### Key Features
- **Google Sheets Frontend**: Familiar interface requiring zero training
- **Multi-Agent AI System**: Specialized agents for each track with separate contexts
- **Real-time Synchronization**: Live data updates between sheets and backend
- **Interactive Controls**: Buttons, dropdowns, and direct cell editing
- **Automated Lead Classification**: AI determines Enterprise vs SMB track routing

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis
- Google Cloud Project with Sheets API enabled
- OpenAI API access

### Installation
```bash
# Clone and install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your configuration

# Set up database
npm run db:migrate

# Deploy Google Apps Script
npm run sheets:setup
npm run sheets:deploy

# Start development server
npm run dev
```

## Architecture

### Google Sheets Structure
1. **Master Dashboard** - Overview and metrics
2. **Lead Intake** - New lead entry form
3. **Enterprise Pipeline** - High-value prospect management
4. **SMB Pipeline** - Volume prospect tracking
5. **Agent Control Panel** - AI agent monitoring and controls
6. **Content & Templates** - Message management
7. **Analytics & Reporting** - Performance metrics

### Multi-Agent System
- **Master Coordinator**: Lead classification and resource allocation
- **Enterprise Agents**: Research, Content Strategy, Relationship Management
- **SMB Agents**: Platform Analysis, Local Outreach, Conversion Optimization

## Usage

### Daily Workflow
1. Open Master Dashboard to see overnight activity
2. Add new leads in Lead Intake sheet
3. Monitor pipeline sheets for prospect updates
4. Use Agent Control Panel for manual interventions
5. Review Analytics for performance insights

### Lead Processing
- Enter lead data → Auto-classification → Agent assignment → Pipeline updates
- Real-time status tracking through Google Sheets
- Manual override controls available in Agent Control Panel

## API Endpoints

### Sheets Integration
- `GET /api/sheets/enterprise-data` - Enterprise pipeline data
- `GET /api/sheets/smb-data` - SMB pipeline data  
- `POST /api/sheets/lead-intake` - Process new leads
- `POST /api/agents/trigger` - Manual agent actions

### Agent Management
- `GET /api/agents/status` - Agent health and performance
- `POST /api/agents/command` - Execute agent commands
- `GET /api/agents/logs` - Agent activity logs

## Development

### Project Structure
```
src/
├── server.js              # Main server entry point
├── config/                # Configuration files
├── models/                # Database models
├── routes/                # API routes
├── agents/                # AI agent implementations
├── services/              # Business logic
├── utils/                 # Utility functions
└── middleware/            # Express middleware

sheets/
├── apps-script/           # Google Apps Script files
├── templates/             # Sheet templates
└── setup/                 # Deployment scripts

scripts/
├── setup-sheets.js        # Initial sheets setup
├── migrate.js             # Database migrations
└── deploy.js              # Production deployment
```

### Testing
```bash
# Run all tests
npm test

# Test specific components
npm test -- --grep "sheets"
npm test -- --grep "agents"
```

## Deployment

### Environment Setup
1. Configure Google Cloud Project and service account
2. Set up PostgreSQL and Redis instances
3. Deploy backend to your preferred cloud platform
4. Configure Google Apps Script with your backend URL

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] Google Sheets created and shared
- [ ] Apps Script deployed and authorized
- [ ] API endpoints tested
- [ ] Agent monitoring enabled

## Support & Maintenance

### Monitoring
- Agent status dashboard in Google Sheets
- Real-time error logging
- Performance metrics tracking

### Troubleshooting
- Check Agent Control Panel for agent status
- Review system logs in sheets
- Verify API connectivity in backend logs

## License
UNLICENSED - Proprietary software for Gallifrey Consulting# gallifrey-rainmaker
