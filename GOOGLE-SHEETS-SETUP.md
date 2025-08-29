# Google Sheets Button Setup Guide

## 🚨 IMPORTANT: Your buttons aren't working because you need to add the Google Apps Script

## Quick Fix Steps (5 minutes):

### 1. Open Your Google Sheet
Go to: https://docs.google.com/spreadsheets/d/1z7FvCnRRAyUpL6RoMdq6KlMwlJbUF1ZHSlHel1hbCTw/edit

### 2. Add the Script
1. Click **Extensions** → **Apps Script**
2. Delete all the default code in the editor
3. Copy and paste the entire contents of `scripts/google-apps-script.js` 
4. Save the project (Ctrl+S or Cmd+S)
5. Name it "Lead Processor" when prompted

### 3. Return to Your Sheet
- Go back to your Google Sheet
- Refresh the page (F5 or Cmd+R)
- You should now see a new menu: **🚀 Lead Actions**

### 4. Setup Headers (One-time)
1. Click **🚀 Lead Actions** → **Setup Headers**
2. This will create proper column headers for your lead processing

### 5. Test the Buttons
- Select any lead row (not the header)
- Try **🚀 Lead Actions** → **Process Lead (AI Analysis)**
- The system will analyze the lead and update the Status, Track, and Confidence columns

---

## Available Button Functions:

### 🤖 Process Lead (AI Analysis)
- Classifies lead as Enterprise or SMB
- Runs AI analysis through your agents
- Updates Status, Track, Confidence columns
- **Usage**: Select a lead row, then click this button

### 🔍 Find Contacts (Hunter.io)
- Searches for contact emails using the company website
- Updates Contact Name and Email columns
- **Usage**: Company must have a website in column E

### 🔬 Research Company  
- Adds company research notes
- Updates the Notes column with company insights
- **Usage**: Select any lead row

### ✉️ Generate Outreach Message
- Creates personalized outreach based on Enterprise/SMB classification
- Saves message to column P for easy copying
- **Usage**: Process lead first to determine track, then generate outreach

---

## Troubleshooting:

### "Script not authorized" error:
1. Go back to Apps Script editor
2. Click **Run** button (▶️) next to any function
3. Follow the authorization prompts
4. Grant permissions to your Google account

### "API Connection Failed":
1. Make sure your Vercel app is deployed and running
2. Check the API_BASE_URL in the Google Apps Script
3. Update it to: `https://gallifrey-rainmaker.vercel.app/api`

### Buttons still not showing:
1. Refresh your Google Sheet page
2. Check that you saved the Apps Script properly
3. The menu should appear as **🚀 Lead Actions** in the top menu bar

---

## Column Layout After Setup:

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Company Name | Contact Name | Email | Phone | Website | Industry | Company Size | Location | Source | Notes | | Status | Track | Confidence | AI Analysis | Outreach Message |

---

## Your Current Lead Data:

✅ **Construction Leads Sheet**: 13 competitor leads  
✅ **Quick Lead Generation Sheet**: 50 new leads  
✅ **New Leads Discovery Sheet**: Ready for more leads

**Total Leads Ready for Processing**: 63+ companies

---

## Next Steps:

1. **Setup the Google Apps Script** (5 minutes) ⚡
2. **Process your existing 63 leads** using the buttons
3. **Use Hunter.io integration** to find contact emails  
4. **Generate personalized outreach messages**
5. **Start contacting prospects!**

---

## Advanced Features (Coming Soon):

- **Automated lead scoring** based on website analysis
- **Bulk processing** of multiple leads at once  
- **CRM integration** with your sales pipeline
- **Follow-up automation** for prospects
- **Response tracking** and analytics

The foundation is built - now it's time to start processing and contacting these leads! 🚀