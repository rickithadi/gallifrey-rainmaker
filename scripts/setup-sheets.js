const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SHEET_TITLE = 'Gallifrey Marketing Automation System';

async function setupGoogleSheets() {
  try {
    console.log('Setting up Google Sheets integration...');

    // Initialize Google Auth - try JSON file first, fallback to env vars
    let auth;
    const jsonPath = '/Users/hadi.rickit/Downloads/ballbud-6096a-c11d5262ae7c.json';
    
    if (fs.existsSync(jsonPath)) {
      console.log('Using Google Service Account JSON file...');
      auth = new google.auth.GoogleAuth({
        keyFile: jsonPath,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });
    } else {
      console.log('Using environment variables for authentication...');
      const privateKey = process.env.GOOGLE_PRIVATE_KEY
        .replace(/\\n/g, '\n')  // Replace literal \n with actual newlines
        .trim();                // Remove any extra whitespace
      
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: privateKey
        },
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Check if spreadsheet already exists
    let spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    
    if (!spreadsheetId) {
      console.log('Creating new spreadsheet...');
      
      // Create new spreadsheet
      const createResponse = await sheets.spreadsheets.create({
        resource: {
          properties: {
            title: SHEET_TITLE
          }
        }
      });
      
      spreadsheetId = createResponse.data.spreadsheetId;
      console.log(`✓ Created spreadsheet: ${spreadsheetId}`);
      
      // Update .env file with spreadsheet ID
      updateEnvFile('GOOGLE_SHEETS_ID', spreadsheetId);
      
      // Share with service account if needed
      await drive.permissions.create({
        fileId: spreadsheetId,
        resource: {
          role: 'writer',
          type: 'user',
          emailAddress: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        }
      });
    } else {
      console.log(`✓ Using existing spreadsheet: ${spreadsheetId}`);
    }

    // Create all required sheets
    await createAllSheets(sheets, spreadsheetId);
    
    console.log('✓ Google Sheets setup completed successfully!');
    console.log(`Spreadsheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    
    return spreadsheetId;
    
  } catch (error) {
    console.error('❌ Google Sheets setup failed:', error);
    throw error;
  }
}

async function createAllSheets(sheets, spreadsheetId) {
  console.log('Creating sheet structure...');
  
  const sheetConfigs = [
    { name: 'Master Dashboard', index: 0 },
    { name: 'Lead Intake', index: 1 },
    { name: 'Enterprise Pipeline', index: 2 },
    { name: 'SMB Pipeline', index: 3 },
    { name: 'Agent Control Panel', index: 4 },
    { name: 'Content & Templates', index: 5 },
    { name: 'Analytics & Reporting', index: 6 }
  ];

  // Get existing sheets
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets.map(sheet => sheet.properties.title);

  const requests = [];

  // Create missing sheets
  for (const config of sheetConfigs) {
    if (!existingSheets.includes(config.name)) {
      requests.push({
        addSheet: {
          properties: {
            title: config.name,
            index: config.index,
            gridProperties: {
              rowCount: 1000,
              columnCount: 26
            }
          }
        }
      });
    }
  }

  // Delete default "Sheet1" if it exists
  const sheet1 = spreadsheet.data.sheets.find(s => s.properties.title === 'Sheet1');
  if (sheet1) {
    requests.push({
      deleteSheet: {
        sheetId: sheet1.properties.sheetId
      }
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });
    
    console.log(`✓ Created ${requests.length} sheets`);
  }

  // Setup initial data for each sheet
  await setupInitialSheetData(sheets, spreadsheetId);
}

async function setupInitialSheetData(sheets, spreadsheetId) {
  console.log('Setting up initial sheet data...');

  const updates = [
    // Master Dashboard
    {
      range: 'Master Dashboard!A1:G11',
      values: [
        ['GALLIFREY MARKETING AUTOMATION DASHBOARD'],
        [''],
        ['Last Updated:', new Date().toISOString(), '', 'System Status:', 'INITIALIZING'],
        [''],
        ['TODAY\'S METRICS', '', '', '', 'TRACK PERFORMANCE'],
        ['New Leads:', 0, '', '', 'Enterprise:', '0 leads'],
        ['Outreach Sent:', 0, '', '', 'SMB:', '0 leads'],
        ['Meetings Booked:', 0, '', '', 'Conversion:', '0%'],
        [''],
        ['RECENT ACTIVITY (Last 24h)'],
        ['Timestamp', 'Lead Name', 'Track', 'Agent', 'Action', 'Result', 'Next Step']
      ]
    },
    
    // Lead Intake
    {
      range: 'Lead Intake!A1:G21',
      values: [
        ['NEW LEAD ENTRY FORM'],
        [''],
        ['Company Name', 'Contact Name', 'Email', 'Phone', 'Website', 'Industry', 'Notes'],
        ...Array(10).fill(['', '', '', '', '', '', '']),
        ['← Add leads here, system will auto-classify and process'],
        [''],
        [''],
        [''],
        [''],
        ['CLASSIFICATION RESULTS'],
        ['Company', 'Track', 'Confidence', 'Agent Assigned', 'Status', 'Next Action']
      ]
    },
    
    // Enterprise Pipeline
    {
      range: 'Enterprise Pipeline!A1:K5',
      values: [
        ['ENTERPRISE TRACK - HIGH VALUE PROSPECTS'],
        [''],
        ['Filters: [Stage: All] [Status: Active] [Agent: All]'],
        [''],
        ['Company', 'Contact', 'Revenue', 'Employees', 'Industry', 'Budget', 'Stage', 'Agent', 'Last Contact', 'Next Action', 'Notes']
      ]
    },
    
    // SMB Pipeline  
    {
      range: 'SMB Pipeline!A1:J5',
      values: [
        ['SMB TRACK - VOLUME PROSPECTS'],
        [''],
        ['Filters: [Industry: All] [Status: Active] [Urgency: All]'],
        [''],
        ['Business', 'Owner', 'Industry', 'Platform Cost', 'Urgency', 'Stage', 'Agent', 'Last Contact', 'Quick Quote', 'Status']
      ]
    },

    // Agent Control Panel
    {
      range: 'Agent Control Panel!A1:F23',
      values: [
        ['AI AGENT MANAGEMENT'],
        [''],
        ['ENTERPRISE AGENTS'],
        ['Agent', 'Status', 'Task Queue', 'Context Size', 'Performance', 'Actions'],
        ['Research Specialist', 'IDLE', '0', '0/16000', '0.00', 'PAUSE/RESUME/RESET'],
        ['Content Strategist', 'IDLE', '0', '0/16000', '0.00', 'PAUSE/RESUME/RESET'],
        ['Relationship Manager', 'IDLE', '0', '0/16000', '0.00', 'PAUSE/RESUME/RESET'],
        [''],
        [''],
        ['SMB AGENTS'],
        ['Platform Analyst', 'IDLE', '0', '0/8000', '0.00', 'PAUSE/RESUME/RESET'],
        ['Local Specialist', 'IDLE', '0', '0/8000', '0.00', 'PAUSE/RESUME/RESET'],
        ['Conversion Optimizer', 'IDLE', '0', '0/8000', '0.00', 'PAUSE/RESUME/RESET'],
        [''],
        [''],
        ['MANUAL OVERRIDES'],
        ['Force Classification:', 'Enterprise', 'Lead ID:', '', 'EXECUTE'],
        ['Trigger Research:', 'Platform Analysis', 'Company:', '', 'EXECUTE'],
        ['Send Custom Message:', 'Follow-up', 'Template:', 'Initial Outreach', 'EXECUTE'],
        [''],
        [''],
        ['SYSTEM LOGS'],
        ['Timestamp', 'Agent', 'Action', 'Target', 'Result', 'Error (if any)']
      ]
    }
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      valueInputOption: 'RAW',
      data: updates
    }
  });

  console.log('✓ Initial sheet data setup completed');
}

function updateEnvFile(key, value) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    // File doesn't exist, will create new one
  }

  const lines = envContent.split('\n');
  let keyFound = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`${key}=`)) {
      lines[i] = `${key}=${value}`;
      keyFound = true;
      break;
    }
  }

  if (!keyFound) {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, lines.join('\n'));
  console.log(`✓ Updated .env file with ${key}`);
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupGoogleSheets().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { setupGoogleSheets };