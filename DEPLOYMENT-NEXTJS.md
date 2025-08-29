# 🚀 Gallifrey Rainmaker - Next.js Deployment Guide

Deploy your Gallifrey Dual-Track Marketing Automation System on modern serverless platforms like Vercel or Fly.io.

## 📋 Prerequisites

- Node.js 18+
- Git repository
- OpenAI API account
- Google Cloud Project with Sheets API enabled

## 🌟 Quick Deploy Options

### Option 1: Deploy to Vercel (Recommended)

#### 1. One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/gallifrey-rainmaker)

#### 2. Manual Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Clone and setup
git clone <your-repo-url>
cd gallifrey-rainmaker
npm install

# Deploy to Vercel
vercel --prod
```

#### 3. Set up Vercel Postgres Database
```bash
# Add Vercel Postgres to your project
vercel storage create postgres

# This will provide:
# - POSTGRES_URL
# - POSTGRES_PRISMA_URL  
# - POSTGRES_URL_NON_POOLING
```

#### 4. Configure Environment Variables in Vercel
Go to your Vercel dashboard → Project → Settings → Environment Variables:

```env
POSTGRES_URL=your-vercel-postgres-url
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
GOOGLE_SHEETS_ID=your-sheets-id
JWT_SECRET=your-secure-random-string
```

#### 5. Run Database Migrations
```bash
# Trigger a redeploy or run locally with production env
vercel env pull .env.local
npm run db:migrate
```

### Option 2: Deploy to Fly.io

#### 1. Install Fly CLI and Setup
```bash
# Install Fly CLI (macOS)
brew install flyctl

# Login to Fly
fly auth login

# Initialize your app
fly launch
```

#### 2. Set up Fly Postgres
```bash
# Create Postgres database
fly postgres create gallifrey-rainmaker-db

# Connect to your app
fly postgres attach gallifrey-rainmaker-db
```

#### 3. Set Environment Variables
```bash
fly secrets set OPENAI_API_KEY="sk-your-openai-key"
fly secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"  
fly secrets set GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
fly secrets set GOOGLE_SHEETS_ID="your-sheets-id"
fly secrets set JWT_SECRET="your-secure-random-string"
```

#### 4. Deploy
```bash
fly deploy
```

## 🔧 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.local.example .env.local

# Edit .env.local with your configuration
```

Required environment variables:
```env
# Database (choose one)
POSTGRES_URL="your-vercel-postgres-url"  # For Vercel
# OR
DATABASE_URL="postgresql://user:pass@localhost:5432/db"  # For local/other

# Required APIs
OPENAI_API_KEY="sk-your-openai-key"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key\n-----END PRIVATE KEY-----"

# Generated during sheets setup
GOOGLE_SHEETS_ID="your-sheets-id"

# Security
JWT_SECRET="your-secure-random-string-32-chars-minimum"
```

### 3. Database Setup

#### For Vercel Postgres (Local Development):
```bash
# Pull environment from Vercel
vercel env pull .env.local

# Run migrations
npm run db:migrate
```

#### For Local PostgreSQL:
```bash
# Install and start PostgreSQL
brew install postgresql
brew services start postgresql
createdb gallifrey_rainmaker

# Update .env.local with local DATABASE_URL
# Run migrations
npm run db:migrate
```

### 4. Google Sheets Setup
```bash
# Create and configure Google Sheets
npm run sheets:setup

# This will:
# - Create a new Google Spreadsheet
# - Set up all required sheets with proper structure  
# - Update your .env.local with GOOGLE_SHEETS_ID
```

### 5. Start Development Server
```bash
npm run dev
```

Open http://localhost:3000 to see your application.

## 📊 Google Service Account Setup

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Google Sheets API
   - Google Drive API

### 2. Create Service Account
1. Go to IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Name: "gallifrey-rainmaker-service"
4. Role: "Editor" (or custom role with Sheets/Drive permissions)
5. Create and download JSON key file

### 3. Extract Credentials
From the downloaded JSON file, extract:
- `client_email` → Use as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → Use as `GOOGLE_PRIVATE_KEY`

**Important**: Keep the `\n` characters in the private key when setting the environment variable.

## 🔗 API Endpoints

Your deployed application provides these endpoints:

- `GET /health` - System health check
- `GET /api/sheets/enterprise-data` - Enterprise pipeline data
- `GET /api/sheets/smb-data` - SMB pipeline data  
- `POST /api/sheets/lead-intake` - Process new leads
- `GET /api/agents/status` - AI agent status

## 🧪 Testing Your Deployment

### 1. Health Check
```bash
curl https://your-app.vercel.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "deployment": "vercel"
}
```

### 2. Test Google Sheets Integration
1. Open your Google Spreadsheet
2. Add a test lead in the "Lead Intake" sheet
3. Check that it appears in Enterprise or SMB pipeline within 30 seconds

### 3. Test API Endpoints
```bash
# Test enterprise data
curl https://your-app.vercel.app/api/sheets/enterprise-data

# Test SMB data  
curl https://your-app.vercel.app/api/sheets/smb-data

# Test agent status
curl https://your-app.vercel.app/api/agents/status
```

## 🔐 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_URL` | Vercel Postgres connection | `postgres://...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email | `service@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Service account private key | `-----BEGIN PRIVATE KEY-----\n...` |
| `GOOGLE_SHEETS_ID` | Master spreadsheet ID | Generated by sheets:setup |
| `JWT_SECRET` | Secure random string | 32+ character random string |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KV_URL` | Vercel KV for caching | Memory fallback |
| `API_KEY` | API key for sheets integration | Auto-generated |
| `CLEARBIT_API_KEY` | Company enrichment | Optional |
| `HUNTER_IO_API_KEY` | Email finding | Optional |

## 🚨 Common Issues & Solutions

### "Database connection failed"
- Verify `POSTGRES_URL` is set correctly
- For Vercel: Ensure Postgres addon is connected
- For Fly.io: Ensure Postgres database is attached

### "Google Sheets access denied"
- Verify service account has access to the spreadsheet
- Check that Google Sheets API is enabled
- Ensure `GOOGLE_PRIVATE_KEY` preserves `\n` characters

### "OpenAI API quota exceeded"
- Check your OpenAI account usage limits
- Consider upgrading your OpenAI plan
- Monitor API usage in OpenAI dashboard

### "Build failed"
- Check all environment variables are set
- Verify Node.js version compatibility (18+)
- Review build logs for specific errors

## 📈 Performance Optimization

### Vercel Specific
- Use Vercel KV for caching (`KV_URL` environment variable)
- Enable Edge Functions for critical API routes
- Configure appropriate function regions

### General Optimization  
- Database query optimization with indexes
- Implement request caching where appropriate
- Monitor function execution times

## 🔄 Continuous Deployment

### GitHub Integration
1. Connect your repository to Vercel/Fly.io
2. Enable automatic deployments on push to main
3. Configure preview deployments for pull requests

### Environment Promotion
```bash
# Vercel: Promote preview to production
vercel --prod

# Fly.io: Deploy from CI/CD
fly deploy --remote-only
```

## 🎯 Next Steps

1. **Configure Custom Domain**: Point your domain to the deployment
2. **Set up Monitoring**: Add error tracking and performance monitoring
3. **Scale Resources**: Adjust database and function resources based on usage
4. **Team Access**: Invite team members to Google Sheets and deployment platform

## 📞 Support

- **Technical Issues**: Check GitHub Issues or create new issue
- **Deployment Help**: Consult platform-specific documentation
- **Business Questions**: Review `GETTING_STARTED.md`

Your Gallifrey Rainmaker system is now ready for production! 🚀