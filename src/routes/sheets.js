const express = require('express');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { apiKeyAuth } = require('../middleware/auth');
const { query } = require('../config/database');
const SheetsService = require('../services/sheetsService');
const { logger, apiLogger } = require('../utils/logger');
const Joi = require('joi');

const router = express.Router();
const sheetsService = new SheetsService();

// Initialize sheets service
sheetsService.initialize().catch(error => {
  logger.error('Failed to initialize sheets service in routes:', error);
});

// Validation schemas
const leadIntakeSchema = Joi.object({
  companyName: Joi.string().required().min(1).max(255),
  contactName: Joi.string().required().min(1).max(200),
  email: Joi.string().email().required(),
  phone: Joi.string().allow('').max(50),
  website: Joi.string().allow('').max(255),
  industry: Joi.string().allow('').max(100),
  notes: Joi.string().allow('').max(1000),
  sheetRowId: Joi.number().integer().min(1)
});

// Get Enterprise pipeline data for sheets
router.get('/enterprise-data', catchAsync(async (req, res) => {
  const startTime = Date.now();

  try {
    const result = await query(`
      SELECT 
        c.name as company_name,
        CONCAT(contacts.first_name, ' ', contacts.last_name) as contact_name,
        ed.annual_revenue,
        c.employee_count,
        c.industry,
        l.budget_range,
        l.stage,
        aa.agent_name as agent_assigned,
        l.updated_at as last_contact,
        COALESCE(
          (SELECT description FROM agent_activities 
           WHERE lead_id = l.id 
           ORDER BY created_at DESC LIMIT 1), 
          'Initial outreach'
        ) as next_action,
        l.notes
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      JOIN contacts ON l.contact_id = contacts.id
      LEFT JOIN enterprise_data ed ON c.id = ed.company_id
      LEFT JOIN agent_assignments aa ON l.id = aa.lead_id AND aa.status = 'active'
      WHERE l.track = 'enterprise' 
        AND l.status != 'closed_lost'
      ORDER BY l.display_priority DESC, l.updated_at DESC
      LIMIT 100
    `);

    // Format for Google Sheets consumption
    const sheetsFormat = result.rows.map(row => ({
      company: row.company_name,
      contact: row.contact_name,
      revenue: row.annual_revenue ? `$${(row.annual_revenue / 1000000).toFixed(1)}M` : '',
      employees: row.employee_count || '',
      industry: row.industry || '',
      budget: row.budget_range || '',
      stage: row.stage || '',
      agent: row.agent_assigned || '',
      lastContact: row.last_contact ? new Date(row.last_contact).toLocaleDateString() : '',
      nextAction: row.next_action || '',
      notes: row.notes || ''
    }));

    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/enterprise-data', 200, duration);

    res.json(sheetsFormat);
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/enterprise-data', 500, duration, error);
    throw error;
  }
}));

// Get SMB pipeline data for sheets
router.get('/smb-data', catchAsync(async (req, res) => {
  const startTime = Date.now();

  try {
    const result = await query(`
      SELECT 
        c.name as company_name,
        CONCAT(contacts.first_name, ' ', contacts.last_name) as contact_name,
        c.industry,
        smb.monthly_platform_cost,
        smb.urgency_level,
        l.stage,
        aa.agent_name as agent_assigned,
        l.updated_at as last_contact,
        CASE 
          WHEN smb.monthly_platform_cost > 0 
          THEN CONCAT('$', ROUND(smb.monthly_platform_cost * 0.3, 0), '/mo savings')
          ELSE 'Assessment needed'
        END as quick_quote,
        l.status
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      JOIN contacts ON l.contact_id = contacts.id
      LEFT JOIN smb_data smb ON c.id = smb.company_id
      LEFT JOIN agent_assignments aa ON l.id = aa.lead_id AND aa.status = 'active'
      WHERE l.track = 'smb' 
        AND l.status != 'closed_lost'
      ORDER BY 
        CASE smb.urgency_level 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
          ELSE 4 
        END,
        l.updated_at DESC
      LIMIT 200
    `);

    // Format for Google Sheets consumption
    const sheetsFormat = result.rows.map(row => ({
      business: row.company_name,
      owner: row.contact_name,
      industry: row.industry || '',
      platformCost: row.monthly_platform_cost ? `$${row.monthly_platform_cost}/mo` : '',
      urgency: row.urgency_level || 'medium',
      stage: row.stage || '',
      agent: row.agent_assigned || '',
      lastContact: row.last_contact ? new Date(row.last_contact).toLocaleDateString() : '',
      quickQuote: row.quick_quote || '',
      status: row.status || ''
    }));

    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/smb-data', 200, duration);

    res.json(sheetsFormat);
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/smb-data', 500, duration, error);
    throw error;
  }
}));

// Process new lead intake from sheets
router.post('/lead-intake', catchAsync(async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate input
    const { error, value } = leadIntakeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const { companyName, contactName, email, phone, website, industry, notes, sheetRowId } = value;

    // Start transaction
    const client = await require('../config/database').getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Check if company exists
      let companyResult = await client.query(
        'SELECT id FROM companies WHERE name = $1',
        [companyName]
      );

      let companyId;
      if (companyResult.rows.length === 0) {
        // Create new company
        const companyInsert = await client.query(
          `INSERT INTO companies (name, website, industry, created_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [companyName, website, industry]
        );
        companyId = companyInsert.rows[0].id;
      } else {
        companyId = companyResult.rows[0].id;
      }

      // Check if contact exists
      let contactResult = await client.query(
        'SELECT id FROM contacts WHERE email = $1',
        [email]
      );

      let contactId;
      if (contactResult.rows.length === 0) {
        // Parse name
        const nameParts = contactName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create new contact
        const contactInsert = await client.query(
          `INSERT INTO contacts (company_id, first_name, last_name, email, phone, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`,
          [companyId, firstName, lastName, email, phone]
        );
        contactId = contactInsert.rows[0].id;
      } else {
        contactId = contactResult.rows[0].id;
      }

      // Create lead
      const leadInsert = await client.query(
        `INSERT INTO leads (
          company_id, contact_id, track, source, status, stage, 
          notes, sheet_row_id, display_priority, created_at, updated_at
        )
        VALUES ($1, $2, 'pending_classification', 'sheets_intake', 'new', 'lead', $3, $4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id`,
        [companyId, contactId, notes, sheetRowId]
      );

      const leadId = leadInsert.rows[0].id;

      await client.query('COMMIT');

      // Queue for AI classification (async)
      const classificationJob = await queueLeadClassification(leadId);

      const duration = Date.now() - startTime;
      apiLogger.logApiRequest('POST', '/sheets/lead-intake', 201, duration);

      res.status(201).json({
        success: true,
        leadId: leadId,
        classificationJobId: classificationJob.id,
        message: 'Lead received and queued for processing'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('POST', '/sheets/lead-intake', 500, duration, error);
    throw error;
  }
}));

// Get dashboard metrics
router.get('/dashboard-metrics', catchAsync(async (req, res) => {
  const startTime = Date.now();

  try {
    // Get today's metrics
    const today = new Date().toISOString().split('T')[0];

    const metricsResult = await query(`
      SELECT 
        COUNT(CASE WHEN DATE(created_at) = $1 THEN 1 END) as new_leads_today,
        COUNT(CASE WHEN track = 'enterprise' THEN 1 END) as enterprise_leads,
        COUNT(CASE WHEN track = 'smb' THEN 1 END) as smb_leads,
        COUNT(CASE WHEN stage = 'meeting' THEN 1 END) as meetings_booked,
        COUNT(CASE WHEN status = 'closed_won' THEN 1 END) as deals_closed
      FROM leads 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `, [today]);

    const outreachResult = await query(`
      SELECT COUNT(*) as outreach_sent
      FROM communications 
      WHERE DATE(sent_at) = $1
    `, [today]);

    const metrics = metricsResult.rows[0];
    const outreach = outreachResult.rows[0];

    const response = {
      newLeads: parseInt(metrics.new_leads_today) || 0,
      outreachSent: parseInt(outreach.outreach_sent) || 0,
      meetingsBooked: parseInt(metrics.meetings_booked) || 0,
      trackPerformance: {
        enterprise: {
          leads: parseInt(metrics.enterprise_leads) || 0,
          conversion: '12%' // Calculate actual conversion rate
        },
        smb: {
          leads: parseInt(metrics.smb_leads) || 0,
          conversion: '8%' // Calculate actual conversion rate
        }
      }
    };

    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/dashboard-metrics', 200, duration);

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/dashboard-metrics', 500, duration, error);
    throw error;
  }
}));

// Get recent activity for dashboard
router.get('/recent-activity', catchAsync(async (req, res) => {
  const startTime = Date.now();
  const limit = parseInt(req.query.limit) || 20;

  try {
    const result = await query(`
      SELECT 
        aa.created_at as timestamp,
        c.name as lead_name,
        l.track,
        aa.agent_name as agent,
        aa.activity_type as action,
        aa.status as result,
        aa.description as next_step
      FROM agent_activities aa
      JOIN leads l ON aa.lead_id = l.id
      JOIN companies c ON l.company_id = c.id
      WHERE aa.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY aa.created_at DESC
      LIMIT $1
    `, [limit]);

    const activities = result.rows.map(row => ({
      timestamp: row.timestamp,
      leadName: row.lead_name,
      track: row.track,
      agent: row.agent,
      action: row.action,
      result: row.result,
      nextStep: row.next_step
    }));

    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/recent-activity', 200, duration);

    res.json(activities);
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('GET', '/sheets/recent-activity', 500, duration, error);
    throw error;
  }
}));

// Sync all sheet data (called by Apps Script)
router.post('/sync-all', apiKeyAuth, catchAsync(async (req, res) => {
  const startTime = Date.now();

  try {
    // Get all data in parallel
    const [enterpriseRes, smbRes, metricsRes, activityRes] = await Promise.all([
      query(`
        SELECT 
          c.name as company_name,
          CONCAT(contacts.first_name, ' ', contacts.last_name) as contact_name,
          ed.annual_revenue,
          c.employee_count,
          c.industry,
          l.budget_range,
          l.stage,
          aa.agent_name as agent_assigned,
          l.updated_at as last_contact,
          COALESCE(
            (SELECT description FROM agent_activities 
             WHERE lead_id = l.id 
             ORDER BY created_at DESC LIMIT 1), 
            'Initial outreach'
          ) as next_action,
          l.notes
        FROM leads l
        JOIN companies c ON l.company_id = c.id
        JOIN contacts ON l.contact_id = contacts.id
        LEFT JOIN enterprise_data ed ON c.id = ed.company_id
        LEFT JOIN agent_assignments aa ON l.id = aa.lead_id AND aa.status = 'active'
        WHERE l.track = 'enterprise' 
          AND l.status != 'closed_lost'
        ORDER BY l.display_priority DESC, l.updated_at DESC
        LIMIT 50
      `),
      // SMB query similar to above...
      query(`SELECT 1 as placeholder`), // Simplified for now
      query(`
        SELECT 
          COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as new_leads_today,
          COUNT(CASE WHEN stage = 'meeting' THEN 1 END) as meetings_booked
        FROM leads 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      `),
      query(`
        SELECT 
          aa.created_at as timestamp,
          c.name as lead_name,
          l.track,
          aa.agent_name as agent,
          aa.activity_type as action,
          aa.status as result
        FROM agent_activities aa
        JOIN leads l ON aa.lead_id = l.id
        JOIN companies c ON l.company_id = c.id
        WHERE aa.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ORDER BY aa.created_at DESC
        LIMIT 10
      `)
    ]);

    const syncData = {
      enterprise: sheetsService.formatEnterpriseData(enterpriseRes.rows),
      smb: [], // Will be populated with SMB data
      metrics: metricsRes.rows[0],
      activities: activityRes.rows,
      lastSync: new Date().toISOString()
    };

    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('POST', '/sheets/sync-all', 200, duration);

    res.json(syncData);
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logApiRequest('POST', '/sheets/sync-all', 500, duration, error);
    throw error;
  }
}));

// Health check endpoint
router.get('/health', catchAsync(async (req, res) => {
  const health = await sheetsService.healthCheck();
  res.json(health);
}));

// Helper function to queue lead classification
async function queueLeadClassification(leadId) {
  // This would integrate with a job queue system like Bull
  // For now, return a mock job ID
  return { id: `classify_${leadId}_${Date.now()}` };
}

module.exports = router;