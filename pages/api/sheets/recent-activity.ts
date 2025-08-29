import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = '10' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50); // Max 50 records

    // Get recent activity from the last 24 hours
    const activityResult = await query(`
      SELECT 
        aa.id,
        aa.activity_type,
        aa.description,
        aa.status,
        aa.created_at as timestamp,
        l.company_name,
        l.contact_name,
        l.track,
        l.id as lead_id
      FROM agent_activities aa
      LEFT JOIN leads l ON aa.lead_id = l.id
      WHERE aa.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY aa.created_at DESC
      LIMIT $1
    `, [limitNum]);

    const activities = activityResult.rows.map((row: any) => {
      // Parse activity type to determine agent and action
      const parts = row.activity_type.split('_');
      let agentType = 'system';
      let action = row.activity_type;

      if (parts.length >= 2) {
        if (parts[0] === 'enterprise') {
          agentType = parts[1] || 'research';
          action = parts.slice(2).join('_') || 'analysis';
        } else if (parts[0] === 'smb') {
          agentType = parts[1] || 'platform';
          action = parts.slice(2).join('_') || 'analysis';
        } else {
          agentType = parts[0];
          action = parts.slice(1).join('_') || 'process';
        }
      }

      // Determine next step based on status and action
      let nextStep = 'Pending';
      if (row.status === 'success') {
        if (action.includes('research')) {
          nextStep = 'Content Strategy';
        } else if (action.includes('content')) {
          nextStep = 'Outreach';
        } else if (action.includes('outreach')) {
          nextStep = 'Follow-up';
        } else {
          nextStep = 'Complete';
        }
      } else if (row.status === 'error') {
        nextStep = 'Retry';
      }

      return {
        timestamp: new Date(row.timestamp).toISOString(),
        leadName: row.company_name || 'Unknown Company',
        track: (row.track || 'unclassified').toUpperCase(),
        agent: agentType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        action: row.description || action.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        result: row.status === 'success' ? 'Success' : 
                row.status === 'error' ? 'Failed' : 
                'In Progress',
        nextStep: nextStep
      };
    });

    return res.status(200).json(activities);

  } catch (error) {
    console.error('Recent activity error:', error);
    
    // Return sample data if database query fails
    const sampleActivities = [
      {
        timestamp: new Date().toISOString(),
        leadName: 'Sample Company',
        track: 'SMB',
        agent: 'System',
        action: 'System Initialized',
        result: 'Success',
        nextStep: 'Awaiting Leads'
      }
    ];

    return res.status(200).json(sampleActivities);
  }
}