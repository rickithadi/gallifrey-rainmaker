import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { createLead } from '../../../src/lib/db';
import { classifyLead, executeAgent } from '../../../src/lib/agents';

// Validation schema
const leadIntakeSchema = z.object({
  companyName: z.string().min(1).max(255),
  contactName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  sheetRowId: z.number().int().min(1).optional()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate input
    const validatedData = leadIntakeSchema.parse(req.body);

    // Create lead in database
    const { leadId, companyId, contactId } = await createLead(validatedData);

    // Get the created lead for classification
    const leadData = {
      id: leadId,
      company_id: companyId,
      contact_id: contactId,
      company_name: validatedData.companyName,
      first_name: validatedData.contactName.split(' ')[0],
      last_name: validatedData.contactName.split(' ').slice(1).join(' '),
      email: validatedData.email,
      phone: validatedData.phone,
      industry: validatedData.industry,
      notes: validatedData.notes
    };

    // Classify lead asynchronously (don't await to avoid timeout)
    classifyAndProcessLead(leadData).catch(console.error);

    res.status(201).json({
      success: true,
      leadId: leadId,
      message: 'Lead received and queued for processing'
    });

  } catch (error) {
    console.error('Error processing lead intake:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Failed to process lead'
    });
  }
}

// Async function to classify and process lead
async function classifyAndProcessLead(leadData: any) {
  try {
    // Classify the lead
    const classification = await classifyLead(leadData);
    
    // Update lead with classification
    const { query } = await import('../../../src/lib/db');
    await query(`
      UPDATE leads 
      SET track = $1, 
          priority = $2, 
          classification_confidence = $3,
          status = 'classified',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [classification.track, classification.priority, classification.confidence, leadData.id]);

    // Trigger appropriate agent based on track
    if (classification.track === 'enterprise') {
      await executeAgent('enterprise_research', leadData);
    } else {
      await executeAgent('smb_platform', leadData);
    }

  } catch (error) {
    console.error('Error in lead classification and processing:', error);
  }
}