# Gallifrey Rainmaker - AI Marketing Automation System
## Claude Code Project Context & Development Standards

### Executive Summary

The Gallifrey Rainmaker is a dual-track AI-powered marketing and sales automation system using **Google Sheets as the primary frontend interface**. The system manages two distinct customer acquisition strategies: Enterprise B2B (Gallifrey Consulting brand) and SMB/Creator ("Own Your Narrative" campaign) through parallel AI agents with separate context windows and specialized expertise.

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 GOOGLE SHEETS FRONTEND                      │
│     Master Dashboard • Lead Management • Agent Control      │
└─────────────────┬───────────────────┬─────────────────────┘
                  │                   │
        ┌─────────▼─────────┐ ┌───────▼──────────┐
        │  Enterprise Sheet │ │   SMB Sheet      │
        │  Real-time Data   │ │  Real-time Data  │
        └─────────┬─────────┘ ┌───────┬──────────┘
                  │           │       │
    ┌─────────────▼───────────▼───────▼────────────────────────┐
    │              CLOUD BACKEND SERVICES                     │
    │    Google Apps Script • Node.js API • AI Agents        │
    └─────────────┬───────────────────┬─────────────────────┘
                  │                   │
    ┌─────────────▼─────────────┐ ┌───▼────────────────────┐
    │   Enterprise Agents       │ │   SMB Agents           │
    │ • Research Specialist     │ │ • Platform Analyst     │
    │ • Content Strategist      │ │ • Local Specialist     │
    │ • Relationship Manager    │ │ • Conversion Optimizer │
    └───────────────────────────┘ └────────────────────────┘
```

### Google Sheets Frontend Structure

The system uses a comprehensive Google Sheets workbook with 7 specialized sheets:

1. **Master Dashboard** - Real-time metrics, activity feed, system status
2. **Lead Intake** - Simple lead entry form with auto-classification
3. **Enterprise Pipeline** - High-value B2B prospects management
4. **SMB Pipeline** - Volume SMB prospects with urgency tracking  
5. **Agent Control Panel** - AI agent management and manual overrides
6. **Content & Templates** - Message templates and content performance
7. **Analytics & Reporting** - Performance analytics and ROI analysis

### AI Agent Specialization Framework

#### Master Coordinator Agent
- **Context:** Global system state, resource allocation, performance metrics
- **Responsibilities:** Lead classification, track routing, resource optimization

#### Enterprise Track Agents
1. **Research Specialist** - Company intelligence, technical assessment, compliance analysis
2. **Content Strategist** - Technical whitepapers, thought leadership, stakeholder content
3. **Relationship Manager** - Multi-stakeholder communication, long-term nurture sequences

#### SMB Track Agents
1. **Platform Analyst** - Platform dependency scoring, cost-benefit analysis, ROI calculations
2. **Local Specialist** - Melbourne market intelligence, community engagement, local SEO
3. **Conversion Optimizer** - Price sensitivity analysis, objection handling, quick-close optimization

### Current Implementation Status

#### ✅ Completed Components
- Next.js application structure with TypeScript
- Basic API endpoints for health, agents, and sheets integration
- Google Apps Script frontend with all 7 sheet structures
- Base agent classes and coordinator framework
- Database schema with PostgreSQL and Vercel integration
- Lead intake and classification system

#### ❌ Known Issues & Gaps
- **Frontend buttons in Google Apps Script not functional**
- **Build process failing**
- **Real-time data synchronization not working**
- Agent implementations are basic/incomplete
- Missing dashboard metrics endpoints
- No comprehensive error handling
- Limited test coverage

#### 🔄 Partially Implemented
- Agent status monitoring (basic)
- Lead processing pipeline (functional but incomplete)
- Database integration (works but needs optimization)

### Mandatory Build & Testing Standards

#### Build Requirements
- **MANDATORY: All builds must pass before pushing to any branch**
- **MANDATORY: Run `npm run build` and verify successful completion**
- **MANDATORY: Run `npm run lint` and fix all errors**
- **MANDATORY: Run type checking and resolve all TypeScript errors**

#### Testing Requirements
- **MANDATORY: Minimum 80% test coverage before pushing**
- **REQUIRED: Unit tests for all API endpoints**
- **REQUIRED: Integration tests for Google Sheets <-> Backend communication**
- **REQUIRED: End-to-end tests for complete lead processing workflows**
- **REQUIRED: Agent functionality tests**

#### Test Commands
```bash
npm test                    # Run all tests
npm run test:coverage      # Check coverage percentage
npm run test:integration   # Run integration tests
npm run test:e2e          # Run end-to-end tests
```

### Parallel Sub-Agent Workflow Standards

#### When to Use Task Tool with Sub-Agents
- **Complex multi-step tasks** requiring 3+ distinct operations
- **Non-trivial implementations** that benefit from specialized expertise
- **Research tasks** requiring extensive codebase exploration
- **Multi-file changes** that can be parallelized
- **Performance optimization** tasks across multiple components

#### Sub-Agent Types Available
- **general-purpose**: Complex research, multi-step tasks, file searches
- **statusline-setup**: Claude Code status line configuration  
- **output-style-setup**: Claude Code output style creation

#### Parallel Workflow Guidelines
1. **Break down large tasks** into independent workstreams
2. **Launch multiple agents concurrently** whenever possible
3. **Coordinate results** from parallel agents before proceeding
4. **Use specialized agents** for domain-specific tasks
5. **General-purpose agents** for complex multi-step workflows

#### Example Usage
```javascript
// Instead of sequential work:
// 1. Fix API endpoint
// 2. Update frontend
// 3. Test integration

// Use parallel approach:
Task(general-purpose): Fix API endpoints in parallel
Task(general-purpose): Update Google Apps Script frontend  
Task(general-purpose): Create integration tests
// Then coordinate results
```

### Technical Standards

#### Code Quality Requirements
- **TypeScript everywhere** - No JavaScript files in src/
- **Strict type checking** enabled
- **ESLint rules** must pass
- **Consistent error handling** across all modules
- **Comprehensive input validation** on all API endpoints
- **Proper async/await** patterns (no callback hell)

#### Security Standards
- **Never log or expose** API keys, secrets, or sensitive data
- **Input sanitization** on all user inputs
- **Rate limiting** on all public endpoints
- **Authentication middleware** for protected routes
- **HTTPS only** in production

#### Database Standards
- **Connection pooling** for performance
- **Proper transaction handling** for data integrity
- **Indexed queries** for performance
- **Backup and recovery** procedures documented

#### API Design Standards
- **RESTful endpoints** with consistent naming
- **Standardized response formats** with proper HTTP status codes
- **Comprehensive error responses** with actionable messages
- **Request/response logging** for debugging
- **API versioning** for future compatibility

### Google Sheets Integration Priorities

#### Critical Fixes Needed
1. **Fix Google Apps Script buttons** - Currently non-functional
2. **Implement real-time sync** - Data not updating between sheets and backend
3. **Complete agent endpoints** - Missing trigger and control functionality
4. **Add dashboard metrics** - No data flowing to Master Dashboard
5. **Error handling** - No user feedback when operations fail

#### Performance Requirements
- **Sheet load time**: <3 seconds for full workbook
- **Data sync latency**: <30 seconds for real-time updates
- **API response time**: <2 seconds for all sheet operations
- **Concurrent users**: Support 5+ simultaneous users

### Development Workflow

#### Before Starting Any Task
1. **Read this CLAUDE.md file** to understand full context
2. **Use Task tool** for complex or multi-step implementations
3. **Launch parallel sub-agents** when tasks can be parallelized
4. **Check current implementation status** before making changes

#### Before Pushing Code
1. **Run full build**: `npm run build`
2. **Run all tests**: `npm test` 
3. **Check coverage**: Must be ≥80%
4. **Run linting**: `npm run lint`
5. **Test manually** in development environment
6. **Verify Google Sheets integration** still works

#### Emergency Procedures
If builds are failing:
1. **STOP all feature work**
2. **Fix build issues first**
3. **Do not push broken code**
4. **Test thoroughly before continuing**

### Project Goals & Success Metrics

#### Business Objectives
- **Lead Processing Speed**: New lead to first outreach <2 hours
- **Data Accuracy**: >95% correct lead classification  
- **Team Efficiency**: 50% reduction in manual data entry
- **User Adoption**: 100% team using sheets within 2 weeks

#### Technical Objectives
- **System Uptime**: >99% availability
- **Response Time**: <2 seconds for all user actions
- **Data Integrity**: Zero data loss during sync operations
- **Error Rate**: <1% API error rate

### Contact & Support Information

- **Primary Use Case**: Dual-track marketing automation with Google Sheets frontend
- **Technology Stack**: Next.js, TypeScript, Google Apps Script, PostgreSQL, OpenAI
- **Deployment**: Vercel (primary), Fly.io (backup)
- **Database**: Vercel Postgres (primary), PostgreSQL (backup)

---

**This CLAUDE.md file contains the complete project context. All development work should reference and follow these standards. When in doubt, prioritize fixing the core Google Sheets integration issues while maintaining high code quality and test coverage.**