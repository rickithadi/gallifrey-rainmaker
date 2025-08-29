import { NextApiRequest, NextApiResponse } from 'next';
import { executeAgent, classifyLead } from '@/lib/agents';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agentType, action, leadId, params } = req.body;

    if (!agentType || !action) {
      return res.status(400).json({ 
        error: 'Missing required parameters: agentType and action required' 
      });
    }

    console.log(`🚀 Triggering ${agentType} agent for action: ${action}`);

    let result;

    switch (action) {
      case 'classify_lead':
        result = await handleClassifyLead(leadId, params);
        break;
      
      case 'research_company':
        result = await handleResearchCompany(agentType, leadId, params);
        break;
      
      case 'generate_content':
        result = await handleGenerateContent(agentType, leadId, params);
        break;
      
      case 'send_outreach':
        result = await handleSendOutreach(agentType, leadId, params);
        break;
      
      case 'analyze_platform':
        result = await handleAnalyzePlatform(agentType, leadId, params);
        break;
      
      case 'calculate_quote':
        result = await handleCalculateQuote(agentType, leadId, params);
        break;
      
      default:
        // Generic agent execution
        if (leadId) {
          const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
          if (leadResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
          }
          
          result = await executeAgent(agentType, leadResult.rows[0]);
        } else {
          result = await executeAgent(agentType, params || {});
        }
        break;
    }

    return res.status(200).json({
      success: true,
      agentType,
      action,
      leadId,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Agent trigger error:', error);
    return res.status(500).json({
      success: false,
      error: 'Agent trigger failed',
      details: (error as Error).message
    });
  }
}

async function handleClassifyLead(leadId: number, params: any) {
  if (!leadId) {
    throw new Error('Lead ID required for classification');
  }

  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) {
    throw new Error('Lead not found');
  }

  const lead = leadResult.rows[0];
  const classification = await classifyLead({
    id: lead.id,
    company_name: lead.company_name,
    industry: lead.industry,
    employee_count: lead.employee_count,
    website: lead.website,
    contact_name: lead.contact_name,
    email: lead.email,
    phone: lead.phone
  });

  // Update lead with classification
  if (params?.forceTrack) {
    classification.track = params.forceTrack;
    classification.confidence = 1.0;
  }

  await query(`
    UPDATE leads 
    SET track = $1, classification_confidence = $2, status = 'classified'
    WHERE id = $3
  `, [classification.track, classification.confidence, leadId]);

  return {
    leadId,
    classification,
    action: 'Lead classified successfully',
    nextSteps: classification.track === 'enterprise' 
      ? ['Research company', 'Identify decision makers', 'Create technical content']
      : ['Analyze platform needs', 'Calculate cost savings', 'Prepare quick quote']
  };
}

async function handleResearchCompany(agentType: string, leadId: number, params: any) {
  if (!leadId) {
    throw new Error('Lead ID required for company research');
  }

  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) {
    throw new Error('Lead not found');
  }

  const research = await executeAgent('enterprise_research', leadResult.rows[0]);
  
  // Update lead status
  await query(`
    UPDATE leads 
    SET status = 'researched', notes = $1
    WHERE id = $2
  `, [research.summary, leadId]);

  return {
    leadId,
    research,
    action: 'Company research completed',
    nextSteps: ['Generate personalized content', 'Identify outreach strategy']
  };
}

async function handleGenerateContent(agentType: string, leadId: number, params: any) {
  if (!leadId) {
    throw new Error('Lead ID required for content generation');
  }

  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) {
    throw new Error('Lead not found');
  }

  const content = await executeAgent('enterprise_content', leadResult.rows[0]);
  
  return {
    leadId,
    content,
    action: 'Content generated successfully',
    nextSteps: ['Review content', 'Schedule outreach']
  };
}

async function handleSendOutreach(agentType: string, leadId: number, params: any) {
  if (!leadId) {
    throw new Error('Lead ID required for outreach');
  }

  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) {
    throw new Error('Lead not found');
  }

  // Simulate outreach sending
  const outreach = {
    summary: 'Personalized outreach email sent',
    confidence: 0.85,
    recommendations: [
      'Follow up in 3 days if no response',
      'Send LinkedIn connection request',
      'Prepare for potential meeting request'
    ]
  };

  // Update lead status
  await query(`
    UPDATE leads 
    SET status = 'outreach_sent', last_contact_date = NOW()
    WHERE id = $1
  `, [leadId]);

  return {
    leadId,
    outreach,
    action: 'Outreach sent successfully',
    nextSteps: ['Monitor for response', 'Schedule follow-up']
  };
}

async function handleAnalyzePlatform(agentType: string, leadId: number, params: any) {
  if (!leadId) {
    throw new Error('Lead ID required for platform analysis');
  }

  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) {
    throw new Error('Lead not found');
  }

  const analysis = await executeAgent('smb_platform', leadResult.rows[0]);
  
  return {
    leadId,
    analysis,
    action: 'Platform analysis completed',
    nextSteps: ['Calculate potential savings', 'Prepare quote']
  };
}

async function handleCalculateQuote(agentType: string, leadId: number, params: any) {
  if (!leadId) {
    throw new Error('Lead ID required for quote calculation');
  }

  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rows.length === 0) {
    throw new Error('Lead not found');
  }

  // Simulate quote calculation
  const quote = {
    summary: 'Quick quote calculated based on platform analysis',
    estimatedSavings: '$2,500/month',
    implementationCost: '$8,000',
    paybackPeriod: '3.2 months',
    confidence: 0.78
  };

  // Update lead with quote
  await query(`
    UPDATE leads 
    SET status = 'quoted', notes = $1
    WHERE id = $2
  `, [JSON.stringify(quote), leadId]);

  return {
    leadId,
    quote,
    action: 'Quote calculated successfully',
    nextSteps: ['Send quote to prospect', 'Schedule demo call']
  };
}