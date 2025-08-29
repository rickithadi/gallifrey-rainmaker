import { sql } from '@vercel/postgres';

export async function getConnection() {
  if (process.env.POSTGRES_URL) {
    // Use Vercel Postgres
    return { query: sql };
  }
  
  // For production without Vercel Postgres, throw error
  throw new Error('No database configuration found. Set POSTGRES_URL for production.');
}

export async function query(text: string, params?: any[]) {
  if (!process.env.POSTGRES_URL) {
    throw new Error('Database not configured. POSTGRES_URL is required.');
  }
  
  // Use Vercel Postgres SQL template
  // For now, we'll use the basic query approach since sql.raw doesn't work
  const result = await sql.query(text, params || []);
  return { rows: result.rows };
}

// Database schema types
export interface Lead {
  id: number;
  company_id: number;
  contact_id: number;
  track: 'enterprise' | 'smb';
  source?: string;
  status: string;
  stage: string;
  priority: 'low' | 'medium' | 'high';
  budget_range?: string;
  timeline?: string;
  notes?: string;
  sheet_row_id?: number;
  display_priority: number;
  classification_confidence?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Company {
  id: number;
  name: string;
  website?: string;
  industry?: string;
  employee_count?: number;
  revenue_range?: string;
  location?: string;
  description?: string;
  founded_year?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Contact {
  id: number;
  company_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  linkedin_url?: string;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AgentAssignment {
  id: number;
  lead_id: number;
  agent_type: string;
  agent_name: string;
  assigned_at: Date;
  status: 'active' | 'inactive' | 'completed';
  context_size: number;
  performance_score: number;
  last_activity?: Date;
  task_queue_length: number;
}

export interface AgentActivity {
  id: number;
  agent_assignment_id: number;
  lead_id: number;
  activity_type: string;
  description?: string;
  input_data?: any;
  output_data?: any;
  status: 'success' | 'error' | 'pending';
  duration_ms?: number;
  error_message?: string;
  created_at: Date;
}

// Helper functions for common queries
export async function getLeadWithDetails(leadId: number) {
  const result = await sql`
    SELECT 
      l.*,
      c.name as company_name,
      c.website,
      c.industry,
      c.employee_count,
      c.revenue_range,
      c.location,
      c.description as company_description,
      contacts.first_name,
      contacts.last_name,
      contacts.email,
      contacts.phone,
      contacts.title,
      contacts.linkedin_url,
      ed.annual_revenue,
      ed.security_requirements,
      ed.compliance_needs,
      ed.technical_stack,
      ed.decision_makers,
      smb.monthly_platform_cost,
      smb.platform_dependencies,
      smb.urgency_level,
      smb.local_market_presence
    FROM leads l
    JOIN companies c ON l.company_id = c.id
    JOIN contacts ON l.contact_id = contacts.id
    LEFT JOIN enterprise_data ed ON c.id = ed.company_id
    LEFT JOIN smb_data smb ON c.id = smb.company_id
    WHERE l.id = ${leadId}
  `;
  
  return (result as unknown as any[])[0] || null;
}

export async function getEnterpriseLeads() {
  const result = await sql`
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
  `;
  
  return result as unknown as any[];
}

export async function getSMBLeads() {
  const result = await sql`
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
  `;
  
  return result as unknown as any[];
}

export async function createLead(leadData: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  website?: string;
  industry?: string;
  notes?: string;
  sheetRowId?: number;
}) {
  const { companyName, contactName, email, phone, website, industry, notes, sheetRowId } = leadData;
  
  
  if (!process.env.POSTGRES_URL) {
    throw new Error('Database not configured. POSTGRES_URL is required.');
  }
  
  try {
    // Check if company exists
    const companyResult = await sql`
      SELECT id FROM companies WHERE name = ${companyName}
    `;
    let companyId;
    const companyRows = (companyResult as any).rows || [];
    if (companyRows.length === 0) {
      // Create new company
      const companyInsert = await sql`
        INSERT INTO companies (name, website, industry, created_at, updated_at)
        VALUES (${companyName}, ${website || null}, ${industry || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      const insertRows = (companyInsert as any).rows || [];
      if (insertRows.length === 0) {
        throw new Error('Failed to create company');
      }
      companyId = insertRows[0].id;
    } else {
      companyId = companyRows[0].id;
    }

    // Check if contact exists
    const contactResult = await sql`
      SELECT id FROM contacts WHERE email = ${email}
    `;

    let contactId;
    const contactRows = (contactResult as any).rows || [];
    if (contactRows.length === 0) {
      // Parse name
      const nameParts = contactName.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create new contact
      const contactInsert = await sql`
        INSERT INTO contacts (company_id, first_name, last_name, email, phone, created_at, updated_at)
        VALUES (${companyId}, ${firstName}, ${lastName}, ${email}, ${phone || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      const contactInsertRows = (contactInsert as any).rows || [];
      if (contactInsertRows.length === 0) {
        throw new Error('Failed to create contact');
      }
      contactId = contactInsertRows[0].id;
    } else {
      contactId = contactRows[0].id;
    }

    // Create lead
    const leadInsert = await sql`
      INSERT INTO leads (
        company_id, contact_id, track, source, status, stage, 
        notes, sheet_row_id, display_priority, created_at, updated_at
      )
      VALUES (${companyId}, ${contactId}, 'smb', 'sheets_intake', 'new', 'lead', ${notes || null}, ${sheetRowId || null}, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const leadInsertRows = (leadInsert as any).rows || [];
    if (leadInsertRows.length === 0) {
      throw new Error('Failed to create lead');
    }
    const leadId = leadInsertRows[0].id;
    return { leadId, companyId, contactId };
    
  } catch (error) {
    throw error;
  }
}