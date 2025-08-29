import { NextApiRequest, NextApiResponse } from 'next';
import { classifyLead, executeAgent } from '@/lib/agents';
import { createLead } from '@/lib/db';
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { leadData, sheetRow } = req.body;
    
    console.log('Processing lead:', leadData);
    
    // Validate required data
    if (!leadData || !leadData.company_name) {
      return res.status(400).json({ error: 'Invalid lead data - company name required' });
    }
    
    // Create lead in database
    const dbLead = await createLead({
      companyName: leadData.company_name,
      contactName: leadData.contact_name || '',
      email: leadData.email || '',
      phone: leadData.phone || '',
      website: leadData.website || '',
      industry: leadData.industry || 'construction',
      notes: leadData.notes || 'Auto-processed from sheet'
    });
    
    console.log('Created lead in DB:', dbLead.leadId);
    
    // Classify the lead (Enterprise vs SMB)
    const classification = await classifyLead({
      id: dbLead.leadId,
      company_name: leadData.company_name,
      industry: leadData.industry,
      employee_count: leadData.company_size,
      website: leadData.website,
      first_name: leadData.contact_name?.split(' ')[0] || '',
      last_name: leadData.contact_name?.split(' ')[1] || '',
      title: leadData.title || '',
      email: leadData.email,
      notes: leadData.notes
    });
    
    console.log('Lead classification:', classification);
    
    // Execute appropriate agent based on classification
    const agentType = classification.track === 'enterprise' ? 'enterprise_research' : 'smb_platform';
    const analysis = await executeAgent(agentType, {
      id: dbLead.leadId,
      company_name: leadData.company_name,
      industry: leadData.industry,
      website: leadData.website
    });
    
    console.log('Agent analysis completed');
    
    // Update the Google Sheet with results
    if (sheetRow && GOOGLE_SHEETS_ID) {
      try {
        const sheets = await getGoogleSheetsClient();
        
        const statusColumn = `L${sheetRow}`; // Status column
        const trackColumn = `M${sheetRow}`;   // Track column  
        const confidenceColumn = `N${sheetRow}`; // Confidence column
        
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: GOOGLE_SHEETS_ID,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              {
                range: statusColumn,
                values: [['PROCESSED']]
              },
              {
                range: trackColumn, 
                values: [[classification.track.toUpperCase()]]
              },
              {
                range: confidenceColumn,
                values: [[`${Math.round(classification.confidence * 100)}%`]]
              }
            ]
          }
        });
        
        console.log('Updated Google Sheet row:', sheetRow);
      } catch (sheetError) {
        console.error('Failed to update Google Sheet:', sheetError);
        // Continue - don't fail the whole process if sheet update fails
      }
    }
    
    return res.status(200).json({
      success: true,
      leadId: dbLead.leadId,
      classification: classification,
      analysis: {
        summary: analysis.summary,
        confidence: analysis.confidence,
        recommendations: analysis.recommendations?.slice(0, 3) // Top 3 recommendations
      }
    });
    
  } catch (error) {
    console.error('Lead processing failed:', error);
    return res.status(500).json({ 
      error: 'Lead processing failed',
      details: (error as Error).message 
    });
  }
}

