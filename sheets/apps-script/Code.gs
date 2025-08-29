/**
 * Gallifrey Rainmaker - Google Apps Script Integration
 * 
 * This script provides the Google Sheets frontend for the dual-track 
 * marketing automation system.
 */

// Configuration
const BACKEND_API_URL = 'https://gallifrey-rainmaker.vercel.app'; // Production URL
const API_KEY = 'your-api-key'; // Set in Script Properties
const REFRESH_INTERVAL_MINUTES = 1;

// Sheet names
const SHEET_NAMES = {
  DASHBOARD: 'Master Dashboard',
  LEAD_INTAKE: 'Lead Intake',
  ENTERPRISE: 'Enterprise Pipeline',
  SMB: 'SMB Pipeline',
  AGENTS: 'Agent Control Panel',
  TEMPLATES: 'Content & Templates',
  ANALYTICS: 'Analytics & Reporting'
};

/**
 * Called when the spreadsheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('Gallifrey Automation')
    .addItem('Refresh All Data', 'refreshAllData')
    .addSeparator()
    .addItem('Sync Lead Intake', 'syncLeadIntake')
    .addItem('Update Agent Status', 'updateAgentStatus')
    .addSeparator()
    .addItem('Setup Auto-Refresh', 'setupAutoRefresh')
    .addItem('Stop Auto-Refresh', 'stopAutoRefresh')
    .addSeparator()
    .addItem('Test Connection', 'testBackendConnection')
    .addToUi();
    
  // Initialize sheets if they don't exist
  initializeSheets();
  
  // Set up automatic refresh
  setupAutoRefresh();
}

/**
 * Initialize all required sheets with proper formatting
 */
function initializeSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create sheets if they don't exist
  Object.values(SHEET_NAMES).forEach(sheetName => {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      setupSheetStructure(sheet, sheetName);
    }
  });
}

/**
 * Setup the structure for each sheet type
 */
function setupSheetStructure(sheet, sheetName) {
  switch (sheetName) {
    case SHEET_NAMES.DASHBOARD:
      setupDashboardSheet(sheet);
      break;
    case SHEET_NAMES.LEAD_INTAKE:
      setupLeadIntakeSheet(sheet);
      break;
    case SHEET_NAMES.ENTERPRISE:
      setupEnterpriseSheet(sheet);
      break;
    case SHEET_NAMES.SMB:
      setupSMBSheet(sheet);
      break;
    case SHEET_NAMES.AGENTS:
      setupAgentControlSheet(sheet);
      break;
  }
}

/**
 * Setup Master Dashboard sheet structure
 */
function setupDashboardSheet(sheet) {
  const headers = [
    ['GALLIFREY MARKETING AUTOMATION DASHBOARD'],
    [''],
    ['Last Updated:', new Date(), '', 'System Status:', 'INITIALIZING'],
    [''],
    ['TODAY\'S METRICS', '', '', '', 'TRACK PERFORMANCE'],
    ['New Leads:', 0, '', '', 'Enterprise:', '0 leads'],
    ['Outreach Sent:', 0, '', '', 'SMB:', '0 leads'],
    ['Meetings Booked:', 0, '', '', 'Conversion:', '0%'],
    [''],
    ['RECENT ACTIVITY (Last 24h)'],
    ['Timestamp', 'Lead Name', 'Track', 'Agent', 'Action', 'Result', 'Next Step']
  ];
  
  sheet.getRange(1, 1, headers.length, 7).setValues(headers);
  
  // Format headers
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  sheet.getRange('A5:A8').setFontWeight('bold');
  sheet.getRange('E5:E8').setFontWeight('bold');
  sheet.getRange('A10:G11').setFontWeight('bold').setBackground('#e6f3ff');
}

/**
 * Setup Lead Intake sheet structure
 */
function setupLeadIntakeSheet(sheet) {
  const headers = [
    ['NEW LEAD ENTRY FORM'],
    [''],
    ['Company Name', 'Contact Name', 'Email', 'Phone', 'Website', 'Industry', 'Notes'],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['← Add leads here, system will auto-classify and process'],
    [''],
    [''],
    [''],
    [''],
    ['CLASSIFICATION RESULTS'],
    ['Company', 'Track', 'Confidence', 'Agent Assigned', 'Status', 'Next Action']
  ];
  
  sheet.getRange(1, 1, headers.length, 7).setValues(headers);
  
  // Format headers
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  sheet.getRange('A3:G3').setFontWeight('bold').setBackground('#d4e6f1');
  sheet.getRange('A20:F20').setFontWeight('bold').setBackground('#d5f4e6');
  
  // Add data validation for common fields
  const industryRange = sheet.getRange('F4:F13');
  const industryValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Professional Services', 'Other'])
    .build();
  industryRange.setDataValidation(industryValidation);
}

/**
 * Setup Enterprise Pipeline sheet structure
 */
function setupEnterpriseSheet(sheet) {
  const headers = [
    ['ENTERPRISE TRACK - HIGH VALUE PROSPECTS'],
    [''],
    ['Filters: [Stage: All] [Status: Active] [Agent: All]'],
    [''],
    ['Company', 'Contact', 'Revenue', 'Employees', 'Industry', 'Budget', 'Stage', 'Agent', 'Last Contact', 'Next Action', 'Notes']
  ];
  
  sheet.getRange(1, 1, headers.length, 11).setValues(headers);
  
  // Format headers
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  sheet.getRange('A5:K5').setFontWeight('bold').setBackground('#fff2cc');
  
  // Set up conditional formatting
  setupEnterpriseConditionalFormatting(sheet);
}

/**
 * Setup SMB Pipeline sheet structure
 */
function setupSMBSheet(sheet) {
  const headers = [
    ['SMB TRACK - VOLUME PROSPECTS'],
    [''],
    ['Filters: [Industry: All] [Status: Active] [Urgency: All]'],
    [''],
    ['Business', 'Owner', 'Industry', 'Platform Cost', 'Urgency', 'Stage', 'Agent', 'Last Contact', 'Quick Quote', 'Status']
  ];
  
  sheet.getRange(1, 1, headers.length, 10).setValues(headers);
  
  // Format headers
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  sheet.getRange('A5:J5').setFontWeight('bold').setBackground('#e1f5fe');
  
  // Set up conditional formatting
  setupSMBConditionalFormatting(sheet);
}

/**
 * Setup Agent Control Panel sheet structure
 */
function setupAgentControlSheet(sheet) {
  const headers = [
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
  ];
  
  sheet.getRange(1, 1, headers.length, 6).setValues(headers);
  
  // Format headers
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  sheet.getRange('A3:A3').setFontWeight('bold').setBackground('#fff2cc');
  sheet.getRange('A10:A10').setFontWeight('bold').setBackground('#e1f5fe');
  sheet.getRange('A16:A16').setFontWeight('bold').setBackground('#fce5cd');
  sheet.getRange('A22:A22').setFontWeight('bold').setBackground('#f4cccc');
}

/**
 * Setup conditional formatting for Enterprise sheet
 */
function setupEnterpriseConditionalFormatting(sheet) {
  const dataRange = sheet.getRange('A6:K1000');
  
  // Hot prospects - Green
  const hotRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Hot')
    .setBackground('#d5f4e6')
    .setRanges([dataRange])
    .build();
    
  // Warm prospects - Yellow
  const warmRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Warm')
    .setBackground('#fff2cc')
    .setRanges([dataRange])
    .build();
    
  // Cold prospects - Red
  const coldRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Cold')
    .setBackground('#fce5cd')
    .setRanges([dataRange])
    .build();
  
  sheet.setConditionalFormatRules([hotRule, warmRule, coldRule]);
}

/**
 * Setup conditional formatting for SMB sheet
 */
function setupSMBConditionalFormatting(sheet) {
  const dataRange = sheet.getRange('A6:J1000');
  
  // High urgency - Red
  const highRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('High')
    .setBackground('#f4cccc')
    .setRanges([dataRange])
    .build();
    
  // Medium urgency - Orange
  const mediumRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Medium')
    .setBackground('#fce5cd')
    .setRanges([dataRange])
    .build();
    
  // Ready to close - Green
  const readyRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Ready')
    .setBackground('#d5f4e6')
    .setRanges([dataRange])
    .build();
  
  sheet.setConditionalFormatRules([highRule, mediumRule, readyRule]);
}

/**
 * Main function to refresh all data from backend
 */
function refreshAllData() {
  try {
    updateSystemStatus('SYNCING...');
    
    // Update all sheets in parallel
    Promise.all([
      updateDashboardMetrics(),
      updateEnterpriseData(),
      updateSMBData(),
      updateAgentStatus(),
      updateRecentActivity()
    ]).then(() => {
      updateSystemStatus('ACTIVE');
      updateLastRefresh();
    }).catch(error => {
      console.error('Refresh failed:', error);
      updateSystemStatus('ERROR');
    });
    
  } catch (error) {
    console.error('Error in refreshAllData:', error);
    updateSystemStatus('ERROR');
  }
}

/**
 * Update dashboard metrics
 */
function updateDashboardMetrics() {
  try {
    const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/api/sheets/dashboard-metrics`, {
      method: 'GET',
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    const data = JSON.parse(response.getContentText());
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DASHBOARD);
    
    // Update metrics
    sheet.getRange('B6').setValue(data.newLeads);
    sheet.getRange('B7').setValue(data.outreachSent);
    sheet.getRange('B8').setValue(data.meetingsBooked);
    
    // Update track performance
    sheet.getRange('F6').setValue(`Enterprise: ${data.trackPerformance.enterprise.leads} leads`);
    sheet.getRange('F7').setValue(`SMB: ${data.trackPerformance.smb.leads} leads`);
    sheet.getRange('F8').setValue(`Conversion: ${data.trackPerformance.enterprise.conversion}`);
    
  } catch (error) {
    console.error('Error updating dashboard metrics:', error);
  }
}

/**
 * Update Enterprise pipeline data
 */
function updateEnterpriseData() {
  try {
    const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/api/sheets/enterprise-data`, {
      method: 'GET',
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    const data = JSON.parse(response.getContentText());
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ENTERPRISE);
    
    // Clear existing data (keep headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 5) {
      sheet.getRange(6, 1, lastRow - 5, 11).clear();
    }
    
    // Add new data
    if (data.length > 0) {
      const values = data.map(item => [
        item.company,
        item.contact,
        item.revenue,
        item.employees,
        item.industry,
        item.budget,
        item.stage,
        item.agent,
        item.lastContact,
        item.nextAction,
        item.notes
      ]);
      
      sheet.getRange(6, 1, values.length, 11).setValues(values);
    }
    
  } catch (error) {
    console.error('Error updating enterprise data:', error);
  }
}

/**
 * Update SMB pipeline data
 */
function updateSMBData() {
  try {
    const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/api/sheets/smb-data`, {
      method: 'GET',
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    const data = JSON.parse(response.getContentText());
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SMB);
    
    // Clear existing data (keep headers)
    const lastRow = sheet.getLastRow();
    if (lastRow > 5) {
      sheet.getRange(6, 1, lastRow - 5, 10).clear();
    }
    
    // Add new data
    if (data.length > 0) {
      const values = data.map(item => [
        item.business,
        item.owner,
        item.industry,
        item.platformCost,
        item.urgency,
        item.stage,
        item.agent,
        item.lastContact,
        item.quickQuote,
        item.status
      ]);
      
      sheet.getRange(6, 1, values.length, 10).setValues(values);
    }
    
  } catch (error) {
    console.error('Error updating SMB data:', error);
  }
}

/**
 * Update agent status
 */
function updateAgentStatus() {
  try {
    const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/api/agents/status`, {
      method: 'GET',
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    const data = JSON.parse(response.getContentText());
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.AGENTS);
    
    // Update enterprise agents (rows 5-7)
    if (data.enterprise_research && data.enterprise_research.length > 0) {
      const agent = data.enterprise_research[0];
      sheet.getRange('B5').setValue(agent.status || 'IDLE');
      sheet.getRange('C5').setValue(agent.queueLength || 0);
      sheet.getRange('E5').setValue(agent.performance || 0.00);
    }
    
    // Update SMB agents (rows 11-13) 
    if (data.smb_platform && data.smb_platform.length > 0) {
      const agent = data.smb_platform[0];
      sheet.getRange('B11').setValue(agent.status || 'IDLE');
      sheet.getRange('C11').setValue(agent.queueLength || 0);
      sheet.getRange('E11').setValue(agent.performance || 0.00);
    }
    
  } catch (error) {
    console.error('Error updating agent status:', error);
  }
}

/**
 * Update recent activity
 */
function updateRecentActivity() {
  try {
    const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/api/sheets/recent-activity?limit=10`, {
      method: 'GET',
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    const data = JSON.parse(response.getContentText());
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DASHBOARD);
    
    // Clear existing activity data
    const lastRow = sheet.getLastRow();
    if (lastRow > 11) {
      sheet.getRange(12, 1, lastRow - 11, 7).clear();
    }
    
    // Add new activity data
    if (data.length > 0) {
      const values = data.map(item => [
        new Date(item.timestamp).toLocaleString(),
        item.leadName,
        item.track,
        item.agent,
        item.action,
        item.result,
        item.nextStep
      ]);
      
      sheet.getRange(12, 1, values.length, 7).setValues(values);
    }
    
  } catch (error) {
    console.error('Error updating recent activity:', error);
  }
}

/**
 * Sync lead intake data to backend
 */
function syncLeadIntake() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LEAD_INTAKE);
    const dataRange = sheet.getRange('A4:G13'); // Lead entry rows
    const values = dataRange.getValues();
    
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      
      // Check if row has data and hasn't been processed
      if (row[0] && row[1] && row[2]) { // Company, Contact, Email required
        const leadData = {
          companyName: row[0],
          contactName: row[1],
          email: row[2],
          phone: row[3] || '',
          website: row[4] || '',
          industry: row[5] || '',
          notes: row[6] || '',
          sheetRowId: i + 4 // Actual row number
        };
        
        try {
          const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/api/sheets/lead-intake`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': getApiKey()
            },
            payload: JSON.stringify(leadData)
          });
          
          if (response.getResponseCode() === 201) {
            // Clear the processed row
            sheet.getRange(i + 4, 1, 1, 7).clear();
            
            // Add to classification results
            const result = JSON.parse(response.getContentText());
            addClassificationResult(sheet, leadData.companyName, 'Processing...', 0, '', 'Queued', 'AI Classification');
          }
          
        } catch (error) {
          console.error(`Error processing lead ${leadData.companyName}:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error('Error in syncLeadIntake:', error);
  }
}

/**
 * Add classification result to the intake sheet
 */
function addClassificationResult(sheet, company, track, confidence, agent, status, nextAction) {
  const resultRange = sheet.getRange('A21:F50');
  const values = resultRange.getValues();
  
  // Find first empty row
  let emptyRow = -1;
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) {
      emptyRow = i + 21;
      break;
    }
  }
  
  if (emptyRow > 0) {
    sheet.getRange(emptyRow, 1, 1, 6).setValues([[
      company, track, confidence, agent, status, nextAction
    ]]);
  }
}

/**
 * Handle edit events
 */
function onEdit(e) {
  const range = e.range;
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  
  // Handle lead intake edits
  if (sheetName === SHEET_NAMES.LEAD_INTAKE && 
      range.getRow() >= 4 && range.getRow() <= 13 &&
      range.getColumn() >= 1 && range.getColumn() <= 7) {
    
    // Trigger sync after a delay to allow user to finish editing
    Utilities.sleep(2000);
    syncLeadIntake();
  }
  
  // Handle agent control button clicks
  if (sheetName === SHEET_NAMES.AGENTS) {
    handleAgentControlClick(range);
  }
}

/**
 * Handle agent control panel button clicks
 */
function handleAgentControlClick(range) {
  const notation = range.getA1Notation();
  
  // Manual override buttons
  if (notation === 'E17') { // Force Classification Execute
    executeForceClassification();
  } else if (notation === 'E18') { // Trigger Research Execute
    executeTriggerResearch();
  } else if (notation === 'E19') { // Send Custom Message Execute
    executeSendCustomMessage();
  }
}

/**
 * Execute force classification
 */
function executeForceClassification() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.AGENTS);
    const track = sheet.getRange('B17').getValue();
    const leadId = sheet.getRange('D17').getValue();
    
    if (!leadId) {
      SpreadsheetApp.getUi().alert('Please enter a Lead ID');
      return;
    }
    
    const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/api/agents/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey()
      },
      payload: JSON.stringify({
        agentType: 'master_coordinator',
        action: 'classify_lead',
        leadId: leadId,
        params: { forceTrack: track }
      })
    });
    
    if (response.getResponseCode() === 200) {
      SpreadsheetApp.getUi().alert('Classification triggered successfully');
      sheet.getRange('E17').setValue('✓ EXECUTED');
    }
    
  } catch (error) {
    console.error('Error in force classification:', error);
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
  }
}

/**
 * Execute trigger research
 */
function executeTriggerResearch() {
  // Similar implementation for research trigger
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.AGENTS);
  sheet.getRange('E18').setValue('✓ EXECUTED');
}

/**
 * Execute send custom message
 */
function executeSendCustomMessage() {
  // Similar implementation for custom message
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.AGENTS);
  sheet.getRange('E19').setValue('✓ EXECUTED');
}

/**
 * Setup automatic refresh every minute
 */
function setupAutoRefresh() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'refreshAllData') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new time-based trigger
  ScriptApp.newTrigger('refreshAllData')
    .timeBased()
    .everyMinutes(REFRESH_INTERVAL_MINUTES)
    .create();
}

/**
 * Stop automatic refresh
 */
function stopAutoRefresh() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'refreshAllData') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * Test backend connection
 */
function testBackendConnection() {
  try {
    const response = UrlFetchApp.fetch(`${BACKEND_API_URL}/health`, {
      method: 'GET'
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.status === 'healthy') {
      SpreadsheetApp.getUi().alert('✓ Backend connection successful!\n\nStatus: ' + data.status + '\nVersion: ' + data.version);
    } else {
      SpreadsheetApp.getUi().alert('⚠ Backend responded but not healthy:\n' + data.status);
    }
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('✗ Backend connection failed:\n' + error.message);
  }
}

/**
 * Update system status on dashboard
 */
function updateSystemStatus(status) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DASHBOARD);
    sheet.getRange('E3').setValue(status);
  } catch (error) {
    console.error('Error updating system status:', error);
  }
}

/**
 * Update last refresh time
 */
function updateLastRefresh() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DASHBOARD);
    sheet.getRange('B3').setValue(new Date());
  } catch (error) {
    console.error('Error updating last refresh:', error);
  }
}

/**
 * Get API key from script properties
 */
function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty('API_KEY') || API_KEY;
}