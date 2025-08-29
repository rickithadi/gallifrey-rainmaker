# 🚀 **Vercel Deployment Setup Guide**

Your Gallifrey Rainmaker project is ready for deployment! Follow these steps to get it live.

## 📋 **Prerequisites Checklist**

Before deploying, make sure you have:
- [ ] OpenAI API key (`sk-...`)
- [ ] Google Service Account credentials (email + private key)
- [ ] Vercel account (free tier is fine)

## 🗄️ **Step 1: Set Up Vercel Postgres Database**

### Via Vercel Dashboard (Recommended):
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Find your `gallifrey-rainmaker` project (should already exist from deployment attempt)
3. Go to the **Storage** tab
4. Click **Create Database**
5. Choose **Postgres**
6. Name: `gallifrey-rainmaker-db`
7. Region: Choose closest to your users
8. Click **Create**

This will automatically add these environment variables:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

### Via CLI Alternative:
```bash
# Navigate to your project
cd /Users/hadi.rickit/dev/gallifreyRainmaker

# Create database (if CLI works)
vercel storage create postgres gallifrey-rainmaker-db
```

## 🔐 **Step 2: Set Environment Variables**

You need to add these environment variables in your Vercel project:

### **Method A: Via Vercel Dashboard** (Easier)
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your `gallifrey-rainmaker` project
3. Go to **Settings** → **Environment Variables**
4. Add each variable below for **Production**, **Preview**, and **Development**

### **Method B: Via CLI**
```bash
# In your project directory, run these commands:
vercel env add OPENAI_API_KEY
vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL
vercel env add GOOGLE_PRIVATE_KEY
vercel env add JWT_SECRET
vercel env add GOOGLE_SHEETS_ID
```

### **Required Environment Variables:**

| Variable | Value Example | Where to Get It |
|----------|---------------|-----------------|
| `OPENAI_API_KEY` | `sk-proj-abc123...` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `service@project.iam.gserviceaccount.com` | Google Cloud Console |
| `GOOGLE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Google Cloud Console JSON key |
| `JWT_SECRET` | `your-random-32-char-string` | Generate random string |
| `GOOGLE_SHEETS_ID` | `1abc123def456...` | Will be auto-set by setup script |

### **How to Generate JWT_SECRET:**
```bash
# Generate a secure random string (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📊 **Step 3: Google Service Account Setup**

If you haven't set up your Google Service Account yet:

1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing

2. **Enable APIs:**
   - Google Sheets API
   - Google Drive API

3. **Create Service Account:**
   - IAM & Admin → Service Accounts
   - Create Service Account
   - Name: `gallifrey-rainmaker`
   - Role: Editor
   - Generate JSON key file

4. **Extract Credentials:**
   - Open the JSON file
   - Copy `client_email` → Use as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - Copy `private_key` → Use as `GOOGLE_PRIVATE_KEY` (keep the \\n characters!)

## 🚀 **Step 4: Deploy to Production**

Once environment variables are set:

```bash
# Deploy to production
vercel --prod
```

This should now complete successfully!

## 🗄️ **Step 5: Run Database Migrations**

After successful deployment:

```bash
# Pull environment variables locally
vercel env pull .env.local

# Run migrations
npm run db:migrate
```

## 📊 **Step 6: Set Up Google Sheets**

```bash
# Create your Google Sheets setup
npm run sheets:setup
```

This will:
- Create a new Google Spreadsheet
- Set up all required sheets with proper structure
- Update your environment variables with the sheet ID

## ✅ **Step 7: Test Your Deployment**

Your app should be live at: `https://gallifrey-rainmaker.vercel.app`

Test these endpoints:
- `https://your-app.vercel.app/health` - Should return system status
- `https://your-app.vercel.app/` - Should show the dashboard
- `https://your-app.vercel.app/api/sheets/enterprise-data` - Should return data

## 🎯 **What's Next?**

1. **Custom Domain** (Optional):
   - Go to Project Settings → Domains
   - Add your custom domain

2. **Set Up Google Sheets Integration:**
   - Deploy the Apps Script code
   - Configure sheet permissions

3. **Start Using the System:**
   - Open your Google Spreadsheet
   - Add test leads in the Lead Intake sheet
   - Watch the AI agents process them!

## 🚨 **Troubleshooting**

### **Build Fails:**
- Check all environment variables are set correctly
- Verify `GOOGLE_PRIVATE_KEY` includes `\\n` characters
- Make sure all required variables are added to Production, Preview, and Development

### **Database Connection Issues:**
- Verify Postgres database was created in Vercel
- Check that `POSTGRES_URL` is automatically set

### **API Errors:**
- Test your OpenAI API key in the OpenAI Playground
- Verify Google Service Account has Sheets/Drive API access

## 📞 **Need Help?**

- Check Vercel deployment logs in the dashboard
- Review the function logs for specific errors
- Test environment variables with: `vercel env ls`

Your Gallifrey Rainmaker system is almost ready! 🎉