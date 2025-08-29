import { NextApiRequest, NextApiResponse } from 'next';
import { getSMBLeads } from '../../../src/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const leads = await getSMBLeads();
    
    // Format for Google Sheets consumption - ensure leads is an array
    const leadsArray = Array.isArray(leads) ? leads : [leads];
    const sheetsFormat = leadsArray.map((row: any) => ({
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

    res.status(200).json(sheetsFormat);
  } catch (error) {
    console.error('Error fetching SMB data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to fetch SMB data'
    });
  }
}