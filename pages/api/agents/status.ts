import { NextApiRequest, NextApiResponse } from 'next';
import { getAgentStatus } from '../../../src/lib/agents';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const agentStatus = await getAgentStatus();
    res.status(200).json(agentStatus);
  } catch (error) {
    console.error('Error fetching agent status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to fetch agent status'
    });
  }
}