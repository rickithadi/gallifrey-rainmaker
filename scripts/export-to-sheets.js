const { google } = require('googleapis');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config({ path: '.env.local' });

class GoogleSheetsExporter {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  }

  async authenticate() {
    try {
      // Create JWT auth
      this.auth = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      await this.auth.authorize();
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      console.log('✅ Google Sheets authentication successful');
      return true;
    } catch (error) {
      console.error('❌ Google Sheets authentication failed:', error.message);
      return false;
    }
  }

  async createNewSheet(sheetName) {
    try {
      const request = {
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 10
                }
              }
            }
          }]
        }
      };

      const response = await this.sheets.spreadsheets.batchUpdate(request);
      const newSheetId = response.data.replies[0].addSheet.properties.sheetId;
      
      console.log(`✅ Created new sheet: ${sheetName} (ID: ${newSheetId})`);
      return newSheetId;
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  Sheet ${sheetName} already exists, using existing sheet`);
        return null;
      }
      throw error;
    }
  }

  async exportLeadsFromCSV(csvFilePath, sheetName = 'Construction Leads') {
    if (!await this.authenticate()) {
      throw new Error('Failed to authenticate with Google Sheets');
    }

    // Read CSV data
    const leads = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          leads.push([
            row['Company Name'] || '',
            row['Contact Name'] || '',
            row['Email'] || '',
            row['Phone'] || '',
            row['Website'] || '',
            row['Industry'] || 'construction',
            row['Company Size'] || '',
            row['Location'] || 'Melbourne',
            row['Source'] || 'automated_discovery',
            row['Notes'] || ''
          ]);
        })
        .on('end', async () => {
          try {
            // Create sheet if it doesn't exist
            await this.createNewSheet(sheetName);

            // Prepare data with headers
            const sheetData = [
              ['Company Name', 'Contact Name', 'Email', 'Phone', 'Website', 'Industry', 'Company Size', 'Location', 'Source', 'Notes'],
              ...leads
            ];

            // Clear existing data and add new data
            const range = `${sheetName}!A1:J${sheetData.length}`;
            
            await this.sheets.spreadsheets.values.clear({
              spreadsheetId: this.spreadsheetId,
              range: `${sheetName}!A:Z`
            });

            const response = await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: range,
              valueInputOption: 'RAW',
              resource: {
                values: sheetData
              }
            });

            console.log(`✅ Successfully exported ${leads.length} leads to Google Sheets`);
            console.log(`📊 Updated range: ${response.data.updatedRange}`);
            console.log(`🔗 View sheet: https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit#gid=0`);
            
            resolve({
              success: true,
              leadsExported: leads.length,
              sheetUrl: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`
            });

          } catch (error) {
            console.error('❌ Failed to export to Google Sheets:', error.message);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('❌ Failed to read CSV file:', error.message);
          reject(error);
        });
    });
  }

  async addLeadToMainSheet(leadData) {
    if (!await this.authenticate()) {
      throw new Error('Failed to authenticate with Google Sheets');
    }

    try {
      // Add to the main leads sheet (assuming it's the first sheet)
      const leadRow = [
        leadData.companyName || '',
        leadData.contactName || '',
        leadData.email || '',
        leadData.phone || '',
        leadData.website || '',
        leadData.industry || 'construction',
        leadData.companySize || '',
        leadData.location || 'Melbourne',
        leadData.source || 'automated_discovery',
        leadData.notes || ''
      ];

      // Find the next empty row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A:A'
      });

      const nextRow = (response.data.values?.length || 0) + 1;
      const range = `A${nextRow}:J${nextRow}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        resource: {
          values: [leadRow]
        }
      });

      console.log(`✅ Added lead: ${leadData.companyName} to row ${nextRow}`);
      return { success: true, row: nextRow };

    } catch (error) {
      console.error('❌ Failed to add lead to Google Sheets:', error.message);
      throw error;
    }
  }

  async formatSheet(sheetName = 'Construction Leads') {
    if (!this.sheets) {
      throw new Error('Not authenticated with Google Sheets');
    }

    try {
      // Get sheet ID
      const spreadsheetInfo = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const sheet = spreadsheetInfo.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        console.log(`⚠️  Sheet ${sheetName} not found`);
        return;
      }

      const sheetId = sheet.properties.sheetId;

      // Format the header row and columns
      const requests = [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 }
                }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        },
        {
          updateDimensionProperties: {
            range: {
              sheetId: sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 10
            },
            properties: {
              pixelSize: 150
            },
            fields: 'pixelSize'
          }
        }
      ];

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: { requests }
      });

      console.log(`✅ Formatted sheet: ${sheetName}`);

    } catch (error) {
      console.error('❌ Failed to format sheet:', error.message);
    }
  }
}

async function exportDiscoveredLeads() {
  console.log('🚀 EXPORTING DISCOVERED LEADS TO GOOGLE SHEETS');
  console.log('===============================================');

  const exporter = new GoogleSheetsExporter();
  
  try {
    // Export the processed construction leads
    const csvFile = 'processed-construction-leads.csv';
    
    if (!fs.existsSync(csvFile)) {
      console.error(`❌ CSV file not found: ${csvFile}`);
      console.log('Run the automated-lead-discovery.js script first to generate the CSV file');
      return;
    }

    console.log(`📄 Found CSV file: ${csvFile}`);
    console.log('🔄 Exporting leads to Google Sheets...');

    const result = await exporter.exportLeadsFromCSV(csvFile, 'Construction Leads');
    
    // Format the sheet for better presentation
    await exporter.formatSheet('Construction Leads');

    console.log('\n✅ EXPORT COMPLETED SUCCESSFULLY!');
    console.log(`📊 Exported ${result.leadsExported} construction company leads`);
    console.log(`🔗 Access your leads: ${result.sheetUrl}`);
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Open the Google Sheet and review the discovered leads');
    console.log('2. Use Hunter.io to find contact emails for each company');
    console.log('3. Research each company to find the right decision maker');
    console.log('4. Add personalized notes based on their website and services');
    console.log('5. Start outreach with personalized messages');

    return result;

  } catch (error) {
    console.error('❌ Export failed:', error.message);
    throw error;
  }
}

// Run the export
if (require.main === module) {
  exportDiscoveredLeads()
    .then(result => {
      console.log('\n🎉 Lead export automation complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Export failed:', error.message);
      process.exit(1);
    });
}

module.exports = { GoogleSheetsExporter, exportDiscoveredLeads };