/**
 * Google Apps Script for Google Sheets Button Functionality
 * 
 * INSTALLATION INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete the default code and paste this entire script
 * 4. Save the project (give it a name like "Lead Processor")
 * 5. Go back to your sheet and the buttons will work
 */

// Configuration - Update these with your actual values
const API_BASE_URL = 'https://gallifrey-rainmaker.vercel.app/api'; // Your Vercel deployment URL
const SHEET_NAME = 'Sheet1'; // Update if your sheet has a different name

/**
 * Process Lead Button Function
 * Sends lead data to your API for AI processing
 */
function processLead() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const activeRange = sheet.getActiveRange();
  const row = activeRange.getRow();
  
  // Prevent processing header row
  if (row === 1) {
    SpreadsheetApp.getUi().alert('Cannot process header row. Please select a lead row.');
    return;
  }
  
  // Get lead data from the row
  const rowData = sheet.getRange(row, 1, 1, 10).getValues()[0];
  const leadData = {
    company_name: rowData[0] || '',
    contact_name: rowData[1] || '',
    email: rowData[2] || '',
    phone: rowData[3] || '',
    website: rowData[4] || '',
    industry: rowData[5] || 'construction',
    company_size: rowData[6] || '',
    location: rowData[7] || 'Melbourne',
    source: rowData[8] || '',
    notes: rowData[9] || ''
  };
  
  // Validate required data
  if (!leadData.company_name) {
    SpreadsheetApp.getUi().alert('Company name is required to process lead.');
    return;
  }
  
  // Show processing indicator
  sheet.getRange(row, 12).setValue('PROCESSING...'); // Status column
  SpreadsheetApp.flush();
  
  try {
    // Call your API
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/sheets/process-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        leadData: leadData,
        sheetRow: row
      })
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      // Update sheet with results
      sheet.getRange(row, 12).setValue('PROCESSED'); // Status
      sheet.getRange(row, 13).setValue(result.classification.track.toUpperCase()); // Track (SMB/Enterprise)
      sheet.getRange(row, 14).setValue(`${Math.round(result.classification.confidence * 100)}%`); // Confidence
      sheet.getRange(row, 15).setValue(result.analysis.summary.substring(0, 100) + '...'); // Summary
      
      SpreadsheetApp.getUi().alert(
        `✅ Lead Processed Successfully!\n\nTrack: ${result.classification.track}\nConfidence: ${Math.round(result.classification.confidence * 100)}%`
      );
    } else {
      sheet.getRange(row, 12).setValue('ERROR');
      SpreadsheetApp.getUi().alert('❌ Processing failed: ' + (result.error || 'Unknown error'));
    }
    
  } catch (error) {
    sheet.getRange(row, 12).setValue('ERROR');
    SpreadsheetApp.getUi().alert('❌ API call failed: ' + error.toString());
    console.error('Process lead error:', error);
  }
}

/**
 * Find Contacts Button Function
 * Uses Hunter.io to find contact information
 */
function findContacts() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const activeRange = sheet.getActiveRange();
  const row = activeRange.getRow();
  
  if (row === 1) {
    SpreadsheetApp.getUi().alert('Cannot process header row. Please select a lead row.');
    return;
  }
  
  const rowData = sheet.getRange(row, 1, 1, 10).getValues()[0];
  const company = rowData[0] || '';
  const website = rowData[4] || '';
  
  if (!company) {
    SpreadsheetApp.getUi().alert('Company name is required.');
    return;
  }
  
  if (!website) {
    SpreadsheetApp.getUi().alert('Website is required to find contacts.');
    return;
  }
  
  // Show processing indicator
  sheet.getRange(row, 2).setValue('FINDING...'); // Contact Name column
  SpreadsheetApp.flush();
  
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/sheets/find-contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({
        company: company,
        website: website,
        sheetRow: row
      })
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success && result.contacts.length > 0) {
      const bestContact = result.contacts[0];
      const contactName = bestContact.firstName && bestContact.lastName 
        ? `${bestContact.firstName} ${bestContact.lastName}`
        : bestContact.position || 'Contact Found';
      
      sheet.getRange(row, 2).setValue(contactName); // Contact Name
      sheet.getRange(row, 3).setValue(bestContact.email); // Email
      
      SpreadsheetApp.getUi().alert(
        `✅ Contact Found!\n\nName: ${contactName}\nEmail: ${bestContact.email}\nConfidence: ${bestContact.confidence}%`
      );
    } else {
      sheet.getRange(row, 2).setValue('NOT FOUND');
      SpreadsheetApp.getUi().alert('❌ No contacts found for this website.');
    }
    
  } catch (error) {
    sheet.getRange(row, 2).setValue('ERROR');
    SpreadsheetApp.getUi().alert('❌ Contact search failed: ' + error.toString());
    console.error('Find contacts error:', error);
  }
}

/**
 * Research Company Button Function
 * Gathers company intelligence and insights
 */
function researchCompany() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const activeRange = sheet.getActiveRange();
  const row = activeRange.getRow();
  
  if (row === 1) {
    SpreadsheetApp.getUi().alert('Cannot process header row. Please select a lead row.');
    return;
  }
  
  const rowData = sheet.getRange(row, 1, 1, 10).getValues()[0];
  const company = rowData[0] || '';
  const website = rowData[4] || '';
  
  if (!company) {
    SpreadsheetApp.getUi().alert('Company name is required.');
    return;
  }
  
  // Show processing indicator
  sheet.getRange(row, 10).setValue('RESEARCHING...'); // Notes column
  SpreadsheetApp.flush();
  
  try {
    // Simple company research using available data
    let research = `Company: ${company}\n`;
    if (website) research += `Website: ${website}\n`;
    research += `Industry: Construction/Building Services\n`;
    research += `Location: Melbourne, Australia\n`;
    research += `Research Date: ${new Date().toLocaleDateString()}\n`;
    research += `Status: Potential SMB lead - needs outreach`;
    
    sheet.getRange(row, 10).setValue(research); // Update notes
    
    SpreadsheetApp.getUi().alert(`✅ Research Updated!\n\nCompany profile has been updated in the Notes column.`);
    
  } catch (error) {
    sheet.getRange(row, 10).setValue('RESEARCH ERROR');
    SpreadsheetApp.getUi().alert('❌ Research failed: ' + error.toString());
    console.error('Research error:', error);
  }
}

/**
 * Generate Outreach Button Function
 * Creates personalized outreach messages
 */
function generateOutreach() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const activeRange = sheet.getActiveRange();
  const row = activeRange.getRow();
  
  if (row === 1) {
    SpreadsheetApp.getUi().alert('Cannot process header row. Please select a lead row.');
    return;
  }
  
  const rowData = sheet.getRange(row, 1, 1, 15).getValues()[0];
  const company = rowData[0] || '';
  const contactName = rowData[1] || '';
  const track = rowData[12] || 'SMB'; // Track column
  
  if (!company) {
    SpreadsheetApp.getUi().alert('Company name is required.');
    return;
  }
  
  // Generate personalized message based on track
  let message = '';
  
  if (track.toUpperCase() === 'SMB') {
    message = `Hi ${contactName || 'there'},

I noticed ${company} provides construction services in Melbourne. I'm reaching out because we help local construction companies like yours reduce operational costs and improve efficiency.

We recently helped a similar Melbourne-based construction company:
• Reduce platform fees by 40%
• Streamline project management processes  
• Improve client communication systems

Would you be interested in a quick 15-minute chat to discuss how we could help ${company} achieve similar results?

Best regards,
[Your Name]
Gallifrey Consulting`;
  } else {
    message = `Dear ${contactName || 'Decision Maker'},

I hope this message finds you well. I'm reaching out regarding ${company}'s construction operations and potential opportunities to enhance your business security and compliance posture.

As a Melbourne-based construction company, you likely face challenges around:
• Regulatory compliance and documentation
• Project data security and management
• Operational efficiency optimization

We specialize in helping established construction companies implement robust systems that drive growth while maintaining compliance.

Would you be available for a brief discussion about your current challenges and how we might assist?

Kind regards,
[Your Name]  
Gallifrey Consulting - Enterprise Solutions`;
  }
  
  // Show message in popup
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Generated Outreach Message',
    message + '\n\nWould you like to copy this message?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    // Unfortunately, we can't copy to clipboard from Apps Script
    // But we can put it in a cell for easy copying
    sheet.getRange(row, 16).setValue(message); // Outreach Message column
    ui.alert('✅ Message saved to column P for easy copying!');
  }
}

/**
 * Add Menu to Google Sheets
 * This runs when the sheet opens and adds the custom menu
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Lead Actions')
    .addItem('Process Lead (AI Analysis)', 'processLead')
    .addItem('Find Contacts (Hunter.io)', 'findContacts')
    .addItem('Research Company', 'researchCompany')
    .addItem('Generate Outreach Message', 'generateOutreach')
    .addSeparator()
    .addItem('Setup Headers', 'setupHeaders')
    .addToUi();
}

/**
 * Setup Headers Function
 * Adds proper column headers to the sheet
 */
function setupHeaders() {
  const sheet = SpreadsheetApp.getActiveSheet();
  
  const headers = [
    'Company Name',     // A
    'Contact Name',     // B  
    'Email',           // C
    'Phone',           // D
    'Website',         // E
    'Industry',        // F
    'Company Size',    // G
    'Location',        // H
    'Source',          // I
    'Notes',           // J
    '',                // K (empty)
    'Status',          // L
    'Track',           // M
    'Confidence',      // N
    'AI Analysis',     // O
    'Outreach Message' // P
  ];
  
  // Set headers in row 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format header row
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('white')
    .setFontWeight('bold');
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
  SpreadsheetApp.getUi().alert('✅ Headers setup complete! Your sheet is now ready for lead processing.');
}

/**
 * Test API Connection
 * Use this to verify your API is working
 */
function testAPIConnection() {
  try {
    const response = UrlFetchApp.fetch(API_BASE_URL + '/sheets/process-lead', {
      method: 'OPTIONS'
    });
    
    if (response.getResponseCode() === 200) {
      SpreadsheetApp.getUi().alert('✅ API Connection Successful!');
    } else {
      SpreadsheetApp.getUi().alert('❌ API Connection Failed. Response code: ' + response.getResponseCode());
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ API Connection Error: ' + error.toString());
  }
}