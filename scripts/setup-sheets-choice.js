const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

class SheetsSetupManager {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.currentSheetId = process.env.GOOGLE_SHEETS_ID;
  }

  async authenticate() {
    this.auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    );

    await this.auth.authorize();
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async analyzeCurrentSheet() {
    console.log('🔍 Analyzing your current Google Sheet...');
    
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.currentSheetId
      });

      const sheet = response.data;
      console.log(`📊 Current Sheet: "${sheet.properties.title}"`);
      
      // Get all sheets/tabs
      const tabs = sheet.sheets.map(s => ({
        name: s.properties.title,
        id: s.properties.sheetId,
        rows: s.properties.gridProperties?.rowCount || 0,
        cols: s.properties.gridProperties?.columnCount || 0
      }));

      console.log('\n📋 Current Tabs:');
      tabs.forEach(tab => {
        console.log(`  - ${tab.name} (${tab.rows} rows x ${tab.cols} cols)`);
      });

      // Check if we have data in Sheet1
      try {
        const dataResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.currentSheetId,
          range: 'A1:J10'
        });
        
        const hasData = dataResponse.data.values && dataResponse.data.values.length > 1;
        console.log(`\n💾 Has existing data: ${hasData ? 'YES' : 'NO'}`);
        
        if (hasData) {
          console.log(`   Rows with data: ${dataResponse.data.values.length}`);
          console.log(`   First row: ${dataResponse.data.values[0]?.slice(0, 3).join(', ')}...`);
        }

      } catch (err) {
        console.log('\n💾 Has existing data: NO (empty sheet)');
      }

      return { sheet, tabs, hasData: false };

    } catch (error) {
      console.error('❌ Error analyzing sheet:', error.message);
      return null;
    }
  }

  async promptUserChoice() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log('\n🤔 CHOOSE YOUR LEAD GENERATION SETUP:');
      console.log('');
      console.log('1️⃣  ADD TABS to existing sheet (keeps everything together)');
      console.log('   ✅ One sheet to manage');
      console.log('   ✅ Easy to compare data');
      console.log('   ❌ Can get messy with lots of data');
      console.log('');
      console.log('2️⃣  CREATE NEW sheet (recommended for lead generation)');
      console.log('   ✅ Clean separation of concerns');
      console.log('   ✅ Better performance with large datasets');
      console.log('   ✅ Easier to share specific data');
      console.log('   ❌ Two sheets to manage');
      console.log('');
      
      rl.question('Enter your choice (1 or 2): ', (answer) => {
        rl.close();
        resolve(answer.trim() === '2' ? 'new' : 'tabs');
      });
    });
  }

  async addTabsToExisting() {
    console.log('\n📑 Adding tabs to your existing sheet...');

    const tabsToCreate = [
      { name: 'Lead Discovery', color: { red: 0.2, green: 0.8, blue: 0.2 } },
      { name: 'Competitor Analysis', color: { red: 0.8, green: 0.4, blue: 0.2 } },
      { name: 'Processed Leads', color: { red: 0.2, green: 0.6, blue: 0.8 } }
    ];

    for (const tab of tabsToCreate) {
      try {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.currentSheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: tab.name,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 16
                  },
                  tabColor: tab.color
                }
              }
            }]
          }
        });
        
        console.log(`✅ Created tab: ${tab.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Tab "${tab.name}" already exists`);
        } else {
          console.error(`❌ Failed to create tab ${tab.name}:`, error.message);
        }
      }
    }

    return this.currentSheetId;
  }

  async createNewSheet() {
    console.log('\n📄 Creating new dedicated lead generation sheet...');

    const newSheet = {
      properties: {
        title: 'Melbourne Construction Leads 2025'
      },
      sheets: [
        {
          properties: {
            title: 'Lead Discovery',
            gridProperties: { rowCount: 1000, columnCount: 16 },
            tabColor: { red: 0.2, green: 0.8, blue: 0.2 }
          }
        },
        {
          properties: {
            title: 'Competitor Analysis', 
            gridProperties: { rowCount: 1000, columnCount: 16 },
            tabColor: { red: 0.8, green: 0.4, blue: 0.2 }
          }
        },
        {
          properties: {
            title: 'High Priority',
            gridProperties: { rowCount: 1000, columnCount: 16 },
            tabColor: { red: 0.8, green: 0.2, blue: 0.2 }
          }
        }
      ]
    };

    try {
      const response = await this.sheets.spreadsheets.create({ resource: newSheet });
      const newSheetId = response.data.spreadsheetId;
      
      // Share with the service account (make sure it has access)
      await this.drive.permissions.create({
        fileId: newSheetId,
        resource: {
          role: 'writer',
          type: 'anyone'  // Makes it accessible to anyone with link
        }
      });

      console.log(`✅ Created new sheet: ${newSheet.properties.title}`);
      console.log(`📄 Sheet ID: ${newSheetId}`);
      console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${newSheetId}/edit`);

      return newSheetId;

    } catch (error) {
      console.error('❌ Failed to create new sheet:', error.message);
      throw error;
    }
  }

  async setupHeaders(sheetId, tabName = 'Lead Discovery') {
    console.log(`📋 Setting up headers in "${tabName}" tab...`);

    const headers = [
      'Company Name', 'Contact Name', 'Email', 'Phone', 'Website',
      'Industry', 'Company Size', 'Location', 'Source', 'Notes',
      '', 'Status', 'Track', 'Confidence', 'AI Analysis', 'Outreach Message'
    ];

    try {
      // Add headers
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!A1:P1`,
        valueInputOption: 'RAW',
        resource: { values: [headers] }
      });

      // Format headers
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        resource: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: await this.getSheetId(sheetId, tabName),
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          }]
        }
      });

      console.log(`✅ Headers setup complete in ${tabName}`);

    } catch (error) {
      console.error('❌ Failed to setup headers:', error.message);
    }
  }

  async getSheetId(spreadsheetId, sheetName) {
    const response = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet?.properties.sheetId || 0;
  }

  async updateEnvFile(newSheetId) {
    if (newSheetId === this.currentSheetId) return;

    console.log('\n🔧 Updating environment configuration...');
    
    const fs = require('fs');
    let envContent = fs.readFileSync('.env.local', 'utf8');
    
    // Update the Google Sheets ID
    envContent = envContent.replace(
      /GOOGLE_SHEETS_ID="[^"]*"/,
      `GOOGLE_SHEETS_ID="${newSheetId}"`
    );
    
    fs.writeFileSync('.env.local', envContent);
    console.log('✅ Updated .env.local with new sheet ID');
  }

  async moveLeadsToNewSetup(targetSheetId, sourceTab = 'Sheet1', targetTab = 'Lead Discovery') {
    console.log(`📤 Moving existing leads to ${targetTab}...`);

    try {
      // Get existing leads from current location
      const currentLeads = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.currentSheetId,
        range: `${sourceTab}!A2:J100`  // Skip header row
      });

      if (currentLeads.data.values && currentLeads.data.values.length > 0) {
        // Add to new location
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: targetSheetId,
          range: `${targetTab}!A:J`,
          valueInputOption: 'RAW',
          resource: {
            values: currentLeads.data.values.filter(row => row.some(cell => cell && cell.trim()))
          }
        });

        console.log(`✅ Moved ${currentLeads.data.values.length} existing leads`);
      } else {
        console.log('ℹ️  No existing leads found to move');
      }

    } catch (error) {
      console.log('ℹ️  Could not move existing leads (may not exist yet)');
    }
  }
}

async function main() {
  console.log('🚀 GOOGLE SHEETS LEAD GENERATION SETUP');
  console.log('=====================================');

  const manager = new SheetsSetupManager();

  try {
    await manager.authenticate();
    console.log('✅ Connected to Google Sheets');

    const analysis = await manager.analyzeCurrentSheet();
    if (!analysis) return;

    const choice = await manager.promptUserChoice();
    
    let targetSheetId;
    
    if (choice === 'new') {
      // Create new dedicated sheet
      targetSheetId = await manager.createNewSheet();
      await manager.updateEnvFile(targetSheetId);
    } else {
      // Add tabs to existing sheet
      targetSheetId = manager.currentSheetId;
      await manager.addTabsToExisting();
    }

    // Setup headers
    await manager.setupHeaders(targetSheetId, 'Lead Discovery');
    
    // Move existing data if applicable
    if (choice === 'new') {
      await manager.moveLeadsToNewSetup(targetSheetId);
    }

    console.log('\n🎉 SETUP COMPLETE!');
    console.log(`📊 Your lead generation sheet: https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`);
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Open the sheet URL above');
    console.log('2. Go to Extensions → Apps Script');
    console.log('3. Paste the code from scripts/google-apps-script.js');
    console.log('4. Save and refresh your sheet');
    console.log('5. Use 🚀 Lead Actions menu to process leads!');

    // Import the discovered leads
    const { GoogleSheetsExporter } = require('./export-to-sheets');
    const exporter = new GoogleSheetsExporter();
    
    if (choice === 'new') {
      // Update the exporter to use new sheet
      exporter.spreadsheetId = targetSheetId;
    }
    
    console.log('\n📥 Importing discovered leads...');
    await exporter.exportLeadsFromCSV('new-leads-batch.csv', 'Lead Discovery');
    
    console.log('\n✨ All done! Your leads are ready for processing.');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SheetsSetupManager };