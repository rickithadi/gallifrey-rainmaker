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
    // Get today's metrics
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Count new leads today
    const newLeadsResult = await query(`
      SELECT COUNT(*) as count
      FROM leads 
      WHERE created_at >= $1 AND created_at <= $2
    `, [todayStart.toISOString(), todayEnd.toISOString()]);

    // Count outreach sent today
    const outreachResult = await query(`
      SELECT COUNT(*) as count
      FROM agent_activities 
      WHERE activity_type LIKE '%outreach%' 
      AND status = 'success'
      AND created_at >= $1 AND created_at <= $2
    `, [todayStart.toISOString(), todayEnd.toISOString()]);

    // Count meetings booked today
    const meetingsResult = await query(`
      SELECT COUNT(*) as count
      FROM agent_activities 
      WHERE activity_type LIKE '%meeting%' 
      AND status = 'success'
      AND created_at >= $1 AND created_at <= $2
    `, [todayStart.toISOString(), todayEnd.toISOString()]);

    // Get track performance
    const enterpriseLeadsResult = await query(`
      SELECT COUNT(*) as count
      FROM leads 
      WHERE track = 'enterprise'
    `);

    const smbLeadsResult = await query(`
      SELECT COUNT(*) as count
      FROM leads 
      WHERE track = 'smb'
    `);

    // Calculate conversion rate for enterprise track
    const enterpriseConversionsResult = await query(`
      SELECT COUNT(*) as count
      FROM leads 
      WHERE track = 'enterprise' 
      AND status IN ('meeting_booked', 'qualified', 'proposal_sent')
    `);

    const enterpriseLeadCount = parseInt(enterpriseLeadsResult.rows[0]?.count || '0');
    const enterpriseConversions = parseInt(enterpriseConversionsResult.rows[0]?.count || '0');
    const enterpriseConversionRate = enterpriseLeadCount > 0 
      ? Math.round((enterpriseConversions / enterpriseLeadCount) * 100) 
      : 0;

    const metrics = {
      newLeads: parseInt(newLeadsResult.rows[0]?.count || '0'),
      outreachSent: parseInt(outreachResult.rows[0]?.count || '0'),
      meetingsBooked: parseInt(meetingsResult.rows[0]?.count || '0'),
      trackPerformance: {
        enterprise: {
          leads: enterpriseLeadCount,
          conversion: `${enterpriseConversionRate}%`
        },
        smb: {
          leads: parseInt(smbLeadsResult.rows[0]?.count || '0'),
          conversion: '0%' // TODO: Implement SMB conversion tracking
        }
      }
    };

    return res.status(200).json(metrics);

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    
    // Return fallback data if database query fails
    return res.status(200).json({
      newLeads: 0,
      outreachSent: 0,
      meetingsBooked: 0,
      trackPerformance: {
        enterprise: {
          leads: 0,
          conversion: '0%'
        },
        smb: {
          leads: 0,
          conversion: '0%'
        }
      }
    });
  }
}