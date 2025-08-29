import { NextApiRequest, NextApiResponse } from 'next';
import { getEnterpriseLeads } from '../../../src/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const leads = await getEnterpriseLeads();
    
    // Format for Google Sheets consumption - ensure leads is an array
    const leadsArray = Array.isArray(leads) ? leads : [leads];
    const sheetsFormat = leadsArray.map((row: any) => ({
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

    res.status(200).json(sheetsFormat);
  } catch (error) {
    console.error('Error fetching enterprise data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to fetch enterprise data'
    });
  }
}