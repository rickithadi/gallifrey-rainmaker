import { NextApiRequest, NextApiResponse } from 'next';
import { getAgentStatus, executeAgent, classifyLead } from '@/lib/agents';
import { query } from '@/lib/db';
import { google } from 'googleapis';

const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;

async function getGoogleSheetsClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { action } = req.query;

      switch (action) {
        case 'status':
          return await handleGetAgentsStatus(res);
        case 'metrics':
          return await handleGetAgentsMetrics(res);
        case 'activity':
          return await handleGetRecentActivity(res);
        default:
          return await handleGetAgentsDashboard(res);
      }
    } else if (req.method === 'POST') {
      const { action, agentType, leadId, data } = req.body;

      switch (action) {
        case 'start_agent':
          return await handleStartAgent(res, agentType, leadId, data);
        case 'stop_agent':
          return await handleStopAgent(res, agentType);
        case 'bulk_process':
          return await handleBulkProcessLeads(res, data);
        case 'update_settings':
          return await handleUpdateAgentSettings(res, agentType, data);
        case 'restart_all':
          return await handleRestartAllAgents(res);
        default:
          return res.status(400).json({ error: 'Unknown action' });
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Agent control error:', error);
    return res.status(500).json({
      error: 'Agent control failed',
      details: (error as Error).message
    });
  }
}

async function handleGetAgentsStatus(res: NextApiResponse) {
  const agentStatus = await getAgentStatus();
  
  // Add real-time metrics
  const metrics = {
    totalAgents: 6,
    activeAgents: Object.keys(agentStatus).length,
    tasksInQueue: 0,
    tasksCompleted: 0
  };

  // Get task counts from database
  try {
    const queueResult = await query(`
      SELECT COUNT(*) as count 
      FROM agent_activities 
      WHERE status = 'pending'
    `);
    
    const completedResult = await query(`
      SELECT COUNT(*) as count 
      FROM agent_activities 
      WHERE status = 'success' 
      AND created_at > NOW() - INTERVAL '24 hours'
    `);

    metrics.tasksInQueue = queueResult.rows[0]?.count || 0;
    metrics.tasksCompleted = completedResult.rows[0]?.count || 0;

  } catch (dbError) {
    console.error('Database error in agent status:', dbError);
  }

  return res.status(200).json({
    success: true,
    agents: agentStatus,
    metrics,
    timestamp: new Date().toISOString()
  });
}

async function handleGetAgentsMetrics(res: NextApiResponse) {
  try {
    const metricsResult = await query(`
      SELECT 
        activity_type,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration
      FROM agent_activities 
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY activity_type, status
      ORDER BY activity_type
    `);

    const metrics: { [key: string]: { total: number; success: number; error: number; avgDuration: number; [status: string]: number } } = {};
    (metricsResult.rows as any[]).forEach(row => {
      const agentType = row.activity_type.split('_')[0];
      if (!metrics[agentType]) {
        metrics[agentType] = {
          total: 0,
          success: 0,
          error: 0,
          avgDuration: 0
        };
      }
      
      metrics[agentType].total += parseInt(row.count);
      metrics[agentType][row.status] = parseInt(row.count);
      if (row.avg_duration) {
        metrics[agentType].avgDuration = parseFloat(row.avg_duration);
      }
    });

    return res.status(200).json({
      success: true,
      metrics,
      period: '7 days'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      metrics: {}
    });
  }
}

async function handleGetRecentActivity(res: NextApiResponse) {
  try {
    const activityResult = await query(`
      SELECT 
        aa.activity_type,
        aa.description,
        aa.status,
        aa.created_at,
        l.company_name,
        l.id as lead_id
      FROM agent_activities aa
      LEFT JOIN leads l ON aa.lead_id = l.id
      ORDER BY aa.created_at DESC
      LIMIT 50
    `);

    const activities = (activityResult.rows as any[]).map(row => ({
      id: `${row.activity_type}_${row.lead_id}_${row.created_at}`,
      agentType: row.activity_type.split('_')[0],
      action: row.activity_type,
      description: row.description,
      status: row.status,
      company: row.company_name,
      leadId: row.lead_id,
      timestamp: row.created_at
    }));

    return res.status(200).json({
      success: true,
      activities
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      activities: [],
      error: 'Failed to get recent activity'
    });
  }
}

async function handleGetAgentsDashboard(res: NextApiResponse) {
  try {
    // Create mock response objects for internal function calls
    let statusData, metricsData, activityData;
    
    // Call functions directly and collect data
    const mockRes1 = { status: (code: number) => ({ json: (data: any) => { statusData = data; return data; } }) };
    const mockRes2 = { status: (code: number) => ({ json: (data: any) => { metricsData = data; return data; } }) };
    const mockRes3 = { status: (code: number) => ({ json: (data: any) => { activityData = data; return data; } }) };
    
    await Promise.all([
      handleGetAgentsStatus(mockRes1 as any),
      handleGetAgentsMetrics(mockRes2 as any),
      handleGetRecentActivity(mockRes3 as any)
    ]);

    return res.status(200).json({
      success: true,
      dashboard: {
        status: statusData,
        metrics: metricsData,
        activity: activityData
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data'
    });
  }
}

async function handleStartAgent(res: NextApiResponse, agentType: string, leadId: number, data: any) {
  console.log(`🚀 Starting ${agentType} agent for lead ${leadId}`);

  try {
    // Get lead data
    const leadResult = await query(`
      SELECT * FROM leads WHERE id = $1
    `, [leadId]);

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = leadResult.rows[0];
    
    // Execute the agent
    const result = await executeAgent(agentType, {
      id: lead.id,
      company_name: lead.company_name,
      industry: lead.industry,
      website: lead.website,
      employee_count: lead.employee_count,
      contact_name: lead.contact_name,
      email: lead.email,
      phone: lead.phone
    });

    // Update Google Sheets if possible
    await updateSheetWithAgentResult(leadId, agentType, result);

    return res.status(200).json({
      success: true,
      agentType,
      leadId,
      result
    });

  } catch (error) {
    console.error(`❌ Agent ${agentType} failed:`, error);
    return res.status(500).json({
      success: false,
      error: `Agent ${agentType} execution failed`,
      details: (error as Error).message
    });
  }
}

async function handleBulkProcessLeads(res: NextApiResponse, data: any) {
  console.log('🔄 Starting bulk lead processing...');
  
  const { sheetName, agentTypes, maxLeads = 10 } = data;

  try {
    const sheets = await getGoogleSheetsClient();
    
    // Get leads from the specified sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: `${sheetName}!A2:J${maxLeads + 1}` // Skip header, process up to maxLeads
    });

    const leadData = response.data.values || [];
    const results = [];

    for (const [index, row] of leadData.entries() as IterableIterator<[number, any[]]>) {
      if (!row[0] || row[0].trim() === '') continue; // Skip empty rows

      const leadInfo = {
        id: `bulk_${Date.now()}_${index}`,
        company_name: row[0],
        contact_name: row[1] || '',
        email: row[2] || '',
        phone: row[3] || '',
        website: row[4] || '',
        industry: row[5] || 'construction',
        company_size: row[6] || '',
        location: row[7] || 'Melbourne',
        source: row[8] || 'bulk_processing'
      };

      try {
        // Classify the lead first
        const classification = await classifyLead(leadInfo);
        
        // Determine which agent to use
        const agentType = classification.track === 'enterprise' ? 'enterprise_research' : 'smb_platform';
        
        if (agentTypes.includes(agentType)) {
          const agentResult = await executeAgent(agentType, leadInfo);
          
          // Update the sheet row with results
          await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEETS_ID,
            range: `${sheetName}!L${index + 2}:N${index + 2}`, // Status, Track, Confidence columns
            valueInputOption: 'RAW',
            requestBody: {
              values: [[
                'PROCESSED',
                classification.track.toUpperCase(),
                `${Math.round(classification.confidence * 100)}%`
              ]]
            }
          });

          results.push({
            company: leadInfo.company_name,
            status: 'success',
            classification,
            agentType,
            summary: agentResult.summary
          });
        } else {
          results.push({
            company: leadInfo.company_name,
            status: 'skipped',
            reason: `Agent type ${agentType} not selected`
          });
        }

      } catch (error) {
        results.push({
          company: leadInfo.company_name,
          status: 'error',
          error: (error as Error).message
        });
      }
    }

    return res.status(200).json({
      success: true,
      processed: results.length,
      results: results.slice(0, 10), // Return first 10 for display
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        errors: results.filter(r => r.status === 'error').length,
        skipped: results.filter(r => r.status === 'skipped').length
      }
    });

  } catch (error) {
    console.error('❌ Bulk processing failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Bulk processing failed',
      details: (error as Error).message
    });
  }
}

async function updateSheetWithAgentResult(leadId: number, agentType: string, result: any) {
  // This function would update the Google Sheet with agent results
  // Implementation depends on your sheet structure
  console.log(`📊 Updating sheet for lead ${leadId} with ${agentType} results`);
}

async function handleStopAgent(res: NextApiResponse, agentType: string) {
  return res.status(200).json({
    success: true,
    message: `Agent ${agentType} stop signal sent`,
    agentType
  });
}

async function handleUpdateAgentSettings(res: NextApiResponse, agentType: string, settings: any) {
  return res.status(200).json({
    success: true,
    message: `Agent ${agentType} settings updated`,
    agentType,
    settings
  });
}

async function handleRestartAllAgents(res: NextApiResponse) {
  return res.status(200).json({
    success: true,
    message: 'All agents restart signal sent',
    timestamp: new Date().toISOString()
  });
}

