/**
 * Agent Control Panel - Google Apps Script
 * 
 * INSTALLATION:
 * 1. Go to your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Add this code to existing script or create new file
 * 4. Save and refresh sheet
 */

const API_BASE_URL = 'https://gallifrey-rainmaker.vercel.app/api';

/**
 * Agent Control Panel Functions
 */

function showAgentControlPanel() {
  const ui = SpreadsheetApp.getUi();
  
  // Get current agent status
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/agents/control?action=status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.success) {
      const statusMessage = buildAgentStatusMessage(data);
      
      const result = ui.alert(
        'Agent Control Panel',
        statusMessage,
        ui.ButtonSet.OK_CANCEL
      );
      
      if (result === ui.Button.OK) {
        showAgentActions();
      }
    } else {
      ui.alert('❌ Failed to get agent status: ' + (data.error || 'Unknown error'));
    }
    
  } catch (error) {
    ui.alert('❌ Connection error: ' + error.toString());
  }
}

function buildAgentStatusMessage(data) {
  let message = '🤖 AGENT STATUS DASHBOARD\n\n';
  
  message += `📊 METRICS:\n`;
  message += `• Total Agents: ${data.metrics.totalAgents}\n`;
  message += `• Active Agents: ${data.metrics.activeAgents}\n`;
  message += `• Tasks in Queue: ${data.metrics.tasksInQueue}\n`;
  message += `• Completed (24h): ${data.metrics.tasksCompleted}\n\n`;
  
  if (Object.keys(data.agents).length > 0) {
    message += `🔧 AGENT STATUS:\n`;
    Object.entries(data.agents).forEach(([type, agents]) => {
      message += `• ${type}: ${agents.length} active\n`;
    });
  } else {
    message += `⚠️ No active agents found\n`;
  }
  
  message += `\nLast Updated: ${new Date(data.timestamp).toLocaleString()}\n`;
  message += `\nClick OK to see available actions...`;
  
  return message;
}

function showAgentActions() {
  const ui = SpreadsheetApp.getUi();
  
  const result = ui.alert(
    'Agent Actions',
    'Choose an action:\n\n' +
    '1. Process Current Lead\n' +
    '2. Bulk Process Leads\n' +
    '3. View Recent Activity\n' +
    '4. Agent Metrics\n' +
    '5. Restart All Agents\n\n' +
    'Click OK to continue, Cancel to close',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result === ui.Button.OK) {
    showActionSelector();
  }
}

function showActionSelector() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.prompt(
    'Select Action',
    'Enter action number (1-5):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const action = response.getResponseText().trim();
    
    switch (action) {
      case '1':
        processCurrentLead();
        break;
      case '2':
        bulkProcessLeads();
        break;
      case '3':
        showRecentActivity();
        break;
      case '4':
        showAgentMetrics();
        break;
      case '5':
        restartAllAgents();
        break;
      default:
        ui.alert('Invalid selection. Please enter 1-5.');
    }
  }
}

function processCurrentLead() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const activeRange = sheet.getActiveRange();
  const row = activeRange.getRow();
  
  if (row === 1) {
    SpreadsheetApp.getUi().alert('Cannot process header row. Please select a lead row.');
    return;
  }
  
  // Get lead data
  const rowData = sheet.getRange(row, 1, 1, 10).getValues()[0];
  const leadData = {
    company_name: rowData[0] || '',
    contact_name: rowData[1] || '',
    email: rowData[2] || '',
    phone: rowData[3] || '',
    website: rowData[4] || '',
    industry: rowData[5] || 'construction',
    company_size: rowData[6] || '',
    location: rowData[7] || 'Melbourne'
  };
  
  if (!leadData.company_name) {
    SpreadsheetApp.getUi().alert('Company name is required. Please select a valid lead row.');
    return;
  }
  
  // Show processing
  sheet.getRange(row, 12).setValue('PROCESSING...');
  SpreadsheetApp.flush();
  
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/sheets/process-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({
        leadData: leadData,
        sheetRow: row
      })
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      sheet.getRange(row, 12).setValue('PROCESSED');
      SpreadsheetApp.getUi().alert(
        `✅ Lead Processed!\n\n` +
        `Company: ${leadData.company_name}\n` +
        `Track: ${result.classification.track}\n` +
        `Confidence: ${Math.round(result.classification.confidence * 100)}%`
      );
    } else {
      sheet.getRange(row, 12).setValue('ERROR');
      SpreadsheetApp.getUi().alert('❌ Processing failed: ' + result.error);
    }
    
  } catch (error) {
    sheet.getRange(row, 12).setValue('ERROR');
    SpreadsheetApp.getUi().alert('❌ Processing failed: ' + error.toString());
  }
}

function bulkProcessLeads() {
  const ui = SpreadsheetApp.getUi();
  
  // Get current sheet name
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();
  
  const response = ui.prompt(
    'Bulk Processing',
    `Process leads from "${sheetName}" sheet.\n\nHow many leads to process? (max 50):`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const maxLeads = parseInt(response.getResponseText()) || 10;
    
    if (maxLeads > 50) {
      ui.alert('Maximum 50 leads can be processed at once.');
      return;
    }
    
    // Show processing message
    ui.alert(`⏳ Processing ${maxLeads} leads from ${sheetName}...\n\nThis may take a few minutes. Click OK to continue.`);
    
    try {
      const apiResponse = UrlFetchApp.fetch(`${API_BASE_URL}/agents/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          action: 'bulk_process',
          data: {
            sheetName: sheetName,
            agentTypes: ['enterprise_research', 'smb_platform'],
            maxLeads: maxLeads
          }
        })
      });
      
      const result = JSON.parse(apiResponse.getContentText());
      
      if (result.success) {
        ui.alert(
          `✅ Bulk Processing Complete!\n\n` +
          `Processed: ${result.processed} leads\n` +
          `Successful: ${result.summary.successful}\n` +
          `Errors: ${result.summary.errors}\n` +
          `Skipped: ${result.summary.skipped}\n\n` +
          `Check the Status column for results.`
        );
      } else {
        ui.alert('❌ Bulk processing failed: ' + result.error);
      }
      
    } catch (error) {
      ui.alert('❌ Bulk processing error: ' + error.toString());
    }
  }
}

function showRecentActivity() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/agents/control?action=activity`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.success && data.activities.length > 0) {
      let message = '📈 RECENT AGENT ACTIVITY\n\n';
      
      data.activities.slice(0, 10).forEach((activity, index) => {
        const time = new Date(activity.timestamp).toLocaleString();
        message += `${index + 1}. ${activity.agentType} - ${activity.company || 'Unknown'}\n`;
        message += `   Status: ${activity.status} | ${time}\n\n`;
      });
      
      ui.alert('Recent Activity', message, ui.ButtonSet.OK);
      
    } else {
      ui.alert('ℹ️ No recent activity found.');
    }
    
  } catch (error) {
    ui.alert('❌ Failed to get activity: ' + error.toString());
  }
}

function showAgentMetrics() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const response = UrlFetchApp.fetch(`${API_BASE_URL}/agents/control?action=metrics`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = JSON.parse(response.getContentText());
    
    if (data.success) {
      let message = '📊 AGENT PERFORMANCE METRICS (7 days)\n\n';
      
      Object.entries(data.metrics).forEach(([agent, metrics]) => {
        const successRate = metrics.total ? ((metrics.success || 0) / metrics.total * 100).toFixed(1) : 0;
        const avgDuration = metrics.avgDuration ? (metrics.avgDuration / 60).toFixed(1) : 0;
        
        message += `🤖 ${agent.toUpperCase()}:\n`;
        message += `   Total Tasks: ${metrics.total || 0}\n`;
        message += `   Success Rate: ${successRate}%\n`;
        message += `   Avg Duration: ${avgDuration} min\n\n`;
      });
      
      ui.alert('Agent Metrics', message, ui.ButtonSet.OK);
      
    } else {
      ui.alert('ℹ️ No metrics data available.');
    }
    
  } catch (error) {
    ui.alert('❌ Failed to get metrics: ' + error.toString());
  }
}

function restartAllAgents() {
  const ui = SpreadsheetApp.getUi();
  
  const result = ui.alert(
    'Restart All Agents',
    'Are you sure you want to restart all agents?\n\nThis will stop current tasks and restart all agent processes.',
    ui.ButtonSet.YES_NO
  );
  
  if (result === ui.Button.YES) {
    try {
      const response = UrlFetchApp.fetch(`${API_BASE_URL}/agents/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          action: 'restart_all'
        })
      });
      
      const data = JSON.parse(response.getContentText());
      
      if (data.success) {
        ui.alert('✅ All agents restarted successfully!');
      } else {
        ui.alert('❌ Restart failed: ' + data.error);
      }
      
    } catch (error) {
      ui.alert('❌ Restart error: ' + error.toString());
    }
  }
}

/**
 * Add Agent Control Panel to menu
 */
function addAgentControlMenu() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 Agent Control')
    .addItem('Show Control Panel', 'showAgentControlPanel')
    .addItem('Process Current Lead', 'processCurrentLead')
    .addItem('Bulk Process Leads', 'bulkProcessLeads')
    .addSeparator()
    .addItem('Recent Activity', 'showRecentActivity')
    .addItem('Agent Metrics', 'showAgentMetrics')
    .addItem('Restart All Agents', 'restartAllAgents')
    .addToUi();
}

/**
 * Enhanced onOpen function - adds both Lead Actions and Agent Control menus
 */
function onOpen() {
  // Add Lead Actions menu (from previous script)
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Lead Actions')
    .addItem('Process Lead (AI Analysis)', 'processLead')
    .addItem('Find Contacts (Hunter.io)', 'findContacts')
    .addItem('Research Company', 'researchCompany')
    .addItem('Generate Outreach Message', 'generateOutreach')
    .addSeparator()
    .addItem('Setup Headers', 'setupHeaders')
    .addToUi();
    
  // Add Agent Control Panel menu
  addAgentControlMenu();
  
  console.log('✅ Agent Control Panel menu added');
}