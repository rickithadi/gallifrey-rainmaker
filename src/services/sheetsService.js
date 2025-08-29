const { google } = require('googleapis');
const { logger, sheetsLogger } = require('../utils/logger');
const { getRedis } = require('../config/database');

class SheetsService {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    this.redis = null;
  }

  async initialize() {
    try {
      // Initialize Google Auth
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
        },
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });

      // Initialize Sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.redis = getRedis();

      // Test connection
      await this.testConnection();
      
      sheetsLogger.info('Google Sheets service initialized successfully');
    } catch (error) {
      sheetsLogger.error('Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      sheetsLogger.info('Sheets connection test successful', {
        spreadsheetTitle: response.data.properties.title,
        sheetCount: response.data.sheets.length
      });
      
      return true;
    } catch (error) {
      sheetsLogger.error('Sheets connection test failed:', error);
      throw new Error(`Google Sheets connection failed: ${error.message}`);
    }
  }

  // Get data from a specific sheet range
  async getSheetData(sheetName, range = 'A:Z') {
    const cacheKey = `sheets:${sheetName}:${range}`;
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        sheetsLogger.info(`Cache hit for ${sheetName}:${range}`);
        return JSON.parse(cached);
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`
      });

      const values = response.data.values || [];
      const duration = Date.now() - startTime;

      // Cache for 30 seconds
      await this.redis.setEx(cacheKey, 30, JSON.stringify(values));

      sheetsLogger.info('Retrieved sheet data', {
        sheetName,
        range,
        rows: values.length,
        duration
      });

      return values;
    } catch (error) {
      const duration = Date.now() - startTime;
      sheetsLogger.error('Failed to get sheet data', {
        sheetName,
        range,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // Update data in a specific sheet range
  async updateSheetData(sheetName, range, values, valueInputOption = 'RAW') {
    const startTime = Date.now();
    const cacheKey = `sheets:${sheetName}:*`;

    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
        valueInputOption,
        resource: { values }
      });

      const duration = Date.now() - startTime;

      // Invalidate cache
      const keys = await this.redis.keys(cacheKey);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }

      sheetsLogger.info('Updated sheet data', {
        sheetName,
        range,
        rowsUpdated: response.data.updatedRows,
        cellsUpdated: response.data.updatedCells,
        duration
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      sheetsLogger.error('Failed to update sheet data', {
        sheetName,
        range,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // Append data to a sheet
  async appendSheetData(sheetName, values, valueInputOption = 'RAW') {
    const startTime = Date.now();

    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption,
        insertDataOption: 'INSERT_ROWS',
        resource: { values }
      });

      const duration = Date.now() - startTime;

      // Invalidate cache
      const cacheKey = `sheets:${sheetName}:*`;
      const keys = await this.redis.keys(cacheKey);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }

      sheetsLogger.info('Appended sheet data', {
        sheetName,
        rowsAdded: values.length,
        cellsUpdated: response.data.updates.updatedCells,
        duration
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      sheetsLogger.error('Failed to append sheet data', {
        sheetName,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // Clear a range in a sheet
  async clearSheetRange(sheetName, range) {
    const startTime = Date.now();

    try {
      const response = await this.sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`
      });

      const duration = Date.now() - startTime;

      // Invalidate cache
      const cacheKey = `sheets:${sheetName}:*`;
      const keys = await this.redis.keys(cacheKey);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }

      sheetsLogger.info('Cleared sheet range', {
        sheetName,
        range,
        duration
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      sheetsLogger.error('Failed to clear sheet range', {
        sheetName,
        range,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // Format data for Enterprise Pipeline sheet
  formatEnterpriseData(leads) {
    return leads.map(lead => [
      lead.company_name || '',
      lead.contact_name || '',
      lead.revenue_range || '',
      lead.employee_count || '',
      lead.industry || '',
      lead.budget_range || '',
      lead.stage || '',
      lead.agent_assigned || '',
      lead.last_contact ? new Date(lead.last_contact).toLocaleDateString() : '',
      lead.next_action || '',
      lead.notes || ''
    ]);
  }

  // Format data for SMB Pipeline sheet
  formatSMBData(leads) {
    return leads.map(lead => [
      lead.company_name || '',
      lead.contact_name || '',
      lead.industry || '',
      lead.monthly_platform_cost ? `$${lead.monthly_platform_cost}` : '',
      lead.urgency_level || '',
      lead.stage || '',
      lead.agent_assigned || '',
      lead.last_contact ? new Date(lead.last_contact).toLocaleDateString() : '',
      lead.quick_quote || '',
      lead.status || ''
    ]);
  }

  // Update dashboard metrics
  async updateDashboardMetrics(metrics) {
    const values = [
      [metrics.newLeads || 0],
      [metrics.outreachSent || 0],
      [metrics.meetingsBooked || 0]
    ];

    await this.updateSheetData('Master Dashboard', 'B6:B8', values);
  }

  // Update recent activity log
  async updateRecentActivity(activities) {
    // Clear existing activity data
    await this.clearSheetRange('Master Dashboard', 'A12:G50');

    if (activities.length > 0) {
      const values = activities.map(activity => [
        new Date(activity.timestamp).toLocaleString(),
        activity.leadName || '',
        activity.track || '',
        activity.agent || '',
        activity.action || '',
        activity.result || '',
        activity.nextStep || ''
      ]);

      await this.updateSheetData('Master Dashboard', 'A12:G12', [
        ['Timestamp', 'Lead Name', 'Track', 'Agent', 'Action', 'Result', 'Next Step']
      ]);

      await this.appendSheetData('Master Dashboard', values);
    }
  }

  // Update agent status in control panel
  async updateAgentStatus(agents) {
    const values = agents.map(agent => [
      agent.name || '',
      agent.status || '',
      agent.currentTask || '',
      agent.queueLength || 0,
      agent.performance || 0.00,
      `=HYPERLINK("#gid=0", "Control")` // Action button placeholder
    ]);

    // Update Enterprise Agents section
    const enterpriseAgents = values.filter((_, index) => index < 3);
    if (enterpriseAgents.length > 0) {
      await this.updateSheetData('Agent Control Panel', 'A5:F7', enterpriseAgents);
    }

    // Update SMB Agents section
    const smbAgents = values.filter((_, index) => index >= 3 && index < 6);
    if (smbAgents.length > 0) {
      await this.updateSheetData('Agent Control Panel', 'A11:F13', smbAgents);
    }
  }

  // Log system activity
  async logSystemActivity(timestamp, agent, action, target, result, error = null) {
    const logEntry = [
      new Date(timestamp).toLocaleString(),
      agent,
      action,
      target,
      result,
      error || ''
    ];

    try {
      // Get current logs
      const currentLogs = await this.getSheetData('Agent Control Panel', 'A24:F74');
      
      // Add new log at the top
      const newLogs = [logEntry, ...currentLogs.slice(0, 49)]; // Keep only 50 most recent
      
      // Clear and update
      await this.clearSheetRange('Agent Control Panel', 'A24:F74');
      await this.updateSheetData('Agent Control Panel', 'A24:F24', [
        ['Timestamp', 'Agent', 'Action', 'Target', 'Result', 'Error (if any)']
      ]);
      
      if (newLogs.length > 0) {
        await this.updateSheetData('Agent Control Panel', 'A25:F74', newLogs);
      }
    } catch (error) {
      sheetsLogger.error('Failed to log system activity', error);
    }
  }

  // Batch operations for better performance
  async batchUpdate(requests) {
    const startTime = Date.now();

    try {
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: requests
        }
      });

      const duration = Date.now() - startTime;

      sheetsLogger.info('Batch update completed', {
        requestCount: requests.length,
        duration
      });

      // Invalidate all cache
      const keys = await this.redis.keys('sheets:*');
      if (keys.length > 0) {
        await this.redis.del(keys);
      }

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      sheetsLogger.error('Batch update failed', {
        requestCount: requests.length,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // Health check for the service
  async healthCheck() {
    try {
      await this.testConnection();
      return {
        status: 'healthy',
        spreadsheetId: this.spreadsheetId,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }
}

module.exports = SheetsService;