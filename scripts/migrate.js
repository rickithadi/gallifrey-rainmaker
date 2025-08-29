const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
  {
    version: 1,
    name: 'create_base_tables',
    sql: `
      -- Companies/Organizations table
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        website VARCHAR(255),
        industry VARCHAR(100),
        employee_count INTEGER,
        revenue_range VARCHAR(50),
        location VARCHAR(255),
        description TEXT,
        founded_year INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Contacts table
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        title VARCHAR(150),
        linkedin_url VARCHAR(255),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Leads table (optimized for sheets display)
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        track VARCHAR(20) NOT NULL CHECK (track IN ('enterprise', 'smb')),
        source VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        stage VARCHAR(50) DEFAULT 'lead',
        priority VARCHAR(20) DEFAULT 'medium',
        budget_range VARCHAR(50),
        timeline VARCHAR(50),
        notes TEXT,
        sheet_row_id INTEGER, -- Maps to Google Sheets row
        display_priority INTEGER DEFAULT 0,
        classification_confidence DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Agent assignments and tracking
      CREATE TABLE IF NOT EXISTS agent_assignments (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        agent_type VARCHAR(50) NOT NULL,
        agent_name VARCHAR(100) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(30) DEFAULT 'active',
        context_size INTEGER DEFAULT 0,
        performance_score DECIMAL(3,2) DEFAULT 0.00,
        last_activity TIMESTAMP,
        task_queue_length INTEGER DEFAULT 0
      );

      -- Agent activities log
      CREATE TABLE IF NOT EXISTS agent_activities (
        id SERIAL PRIMARY KEY,
        agent_assignment_id INTEGER REFERENCES agent_assignments(id) ON DELETE CASCADE,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        description TEXT,
        input_data JSONB,
        output_data JSONB,
        status VARCHAR(30) NOT NULL,
        duration_ms INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Outreach communications
      CREATE TABLE IF NOT EXISTS communications (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL, -- email, linkedin, phone, meeting
        direction VARCHAR(20) NOT NULL, -- outbound, inbound
        subject VARCHAR(255),
        content TEXT,
        template_used VARCHAR(100),
        sent_by VARCHAR(100), -- agent name or 'manual'
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        replied_at TIMESTAMP,
        meeting_scheduled_at TIMESTAMP,
        status VARCHAR(30) DEFAULT 'draft',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Sheet synchronization log
      CREATE TABLE IF NOT EXISTS sheet_sync_log (
        id SERIAL PRIMARY KEY,
        sheet_name VARCHAR(100) NOT NULL,
        operation VARCHAR(50) NOT NULL, -- UPDATE, INSERT, DELETE
        rows_affected INTEGER DEFAULT 0,
        sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL, -- SUCCESS, ERROR
        error_message TEXT,
        duration_ms INTEGER
      );

      -- System configuration
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_leads_track ON leads(track);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
      CREATE INDEX IF NOT EXISTS idx_leads_sheet_row ON leads(sheet_row_id);
      CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads(updated_at);
      CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_agent_activities_created ON agent_activities(created_at);
      CREATE INDEX IF NOT EXISTS idx_communications_sent ON communications(sent_at);
    `
  },
  {
    version: 2,
    name: 'add_enterprise_smb_specifics',
    sql: `
      -- Enterprise-specific data
      CREATE TABLE IF NOT EXISTS enterprise_data (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        annual_revenue BIGINT,
        security_requirements TEXT,
        compliance_needs TEXT,
        technical_stack TEXT,
        decision_makers JSONB, -- Array of decision maker info
        procurement_process TEXT,
        budget_cycle VARCHAR(50),
        competitive_landscape TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- SMB-specific data
      CREATE TABLE IF NOT EXISTS smb_data (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        monthly_platform_cost DECIMAL(10,2),
        platform_dependencies JSONB, -- Array of platforms and costs
        local_market_presence TEXT,
        urgency_level VARCHAR(20) DEFAULT 'medium',
        quick_win_opportunities TEXT,
        price_sensitivity VARCHAR(20),
        local_competitors TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Platform analysis for SMB track
      CREATE TABLE IF NOT EXISTS platform_analysis (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        platform_name VARCHAR(100) NOT NULL,
        monthly_cost DECIMAL(10,2),
        dependency_score INTEGER, -- 1-10 scale
        replacement_difficulty VARCHAR(20),
        cost_savings_potential DECIMAL(10,2),
        analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Templates and content management
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        track VARCHAR(20) NOT NULL CHECK (track IN ('enterprise', 'smb', 'both')),
        category VARCHAR(50),
        subject_line VARCHAR(255),
        body_template TEXT NOT NULL,
        personalization_tags JSONB, -- Array of available tags
        usage_count INTEGER DEFAULT 0,
        success_rate DECIMAL(3,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Performance metrics tracking
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        track VARCHAR(20) NOT NULL,
        leads_generated INTEGER DEFAULT 0,
        leads_qualified INTEGER DEFAULT 0,
        meetings_scheduled INTEGER DEFAULT 0,
        proposals_sent INTEGER DEFAULT 0,
        deals_closed INTEGER DEFAULT 0,
        revenue_generated DECIMAL(12,2) DEFAULT 0.00,
        avg_response_time_hours DECIMAL(5,2),
        agent_efficiency_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Add indexes
      CREATE INDEX IF NOT EXISTS idx_enterprise_data_company ON enterprise_data(company_id);
      CREATE INDEX IF NOT EXISTS idx_smb_data_company ON smb_data(company_id);
      CREATE INDEX IF NOT EXISTS idx_platform_analysis_company ON platform_analysis(company_id);
      CREATE INDEX IF NOT EXISTS idx_templates_track ON message_templates(track);
      CREATE INDEX IF NOT EXISTS idx_performance_date_track ON performance_metrics(date, track);
    `
  },
  {
    version: 3,
    name: 'insert_default_data',
    sql: `
      -- Insert default message templates
      INSERT INTO message_templates (name, track, category, subject_line, body_template, personalization_tags) VALUES
      ('Enterprise Initial Outreach', 'enterprise', 'initial', 'Security & Compliance Assessment for {company_name}', 
       'Hi {contact_name},\n\nI noticed {company_name} operates in the {industry} sector and likely deals with sensitive data and compliance requirements.\n\nWe''ve helped companies like {similar_company} reduce security risks while improving operational efficiency. I''d like to share a brief assessment of potential vulnerabilities in your current setup.\n\nWould you be open to a 15-minute conversation this week?\n\nBest regards,\n{sender_name}',
       '["company_name", "contact_name", "industry", "similar_company", "sender_name"]'),
      
      ('SMB Platform Risk Alert', 'smb', 'urgency', 'Potential Risk: {platform_name} Dependencies at {company_name}', 
       'Hi {contact_name},\n\nI was reviewing local Melbourne businesses and noticed {company_name} might be heavily dependent on {platform_name} for critical operations.\n\nWith recent platform changes affecting many businesses, I wanted to share a quick risk assessment and some alternatives that could save you approximately {monthly_savings}/month.\n\nWould a brief 10-minute call be valuable?\n\nCheers,\n{sender_name}',
       '["company_name", "contact_name", "platform_name", "monthly_savings", "sender_name"]'),
       
      ('Enterprise Follow-up', 'enterprise', 'followup', 'Re: Security Assessment for {company_name}',
       'Hi {contact_name},\n\nI wanted to follow up on our discussion about {company_name}''s security posture.\n\nI''ve prepared a preliminary analysis that identifies {risk_count} potential areas for improvement, including:\n\n• {primary_risk}\n• {secondary_risk}\n• {compliance_gap}\n\nThis assessment typically takes our clients 2-3 weeks to complete internally. I can share the findings in a 15-minute call at your convenience.\n\nBest regards,\n{sender_name}',
       '["company_name", "contact_name", "risk_count", "primary_risk", "secondary_risk", "compliance_gap", "sender_name"]'),
       
      ('SMB Local Business Opportunity', 'smb', 'local', 'Melbourne Business Opportunity: Cost Reduction for {company_name}',
       'Hi {contact_name},\n\nAs a Melbourne-based business, {company_name} caught my attention for your innovative approach in the {industry} space.\n\nI''ve been helping local businesses reduce operational costs, and I believe there''s a significant opportunity to save {company_name} around {potential_savings}/month while improving efficiency.\n\nWould you be interested in a quick 10-minute chat to explore this?\n\nCheers,\n{sender_name}\nP.S. I''m based in {local_area} too!',
       '["company_name", "contact_name", "industry", "potential_savings", "sender_name", "local_area"]');

      -- Insert default system configuration
      INSERT INTO system_config (key, value, description) VALUES
      ('google_sheets_id', '""', 'Master Google Sheets spreadsheet ID'),
      ('max_concurrent_agents', '6', 'Maximum number of concurrent AI agents'),
      ('lead_classification_threshold', '0.80', 'Minimum confidence for automatic lead classification'),
      ('sync_interval_minutes', '1', 'Interval for Google Sheets synchronization'),
      ('agent_context_limits', '{"enterprise_research": 16000, "enterprise_content": 16000, "enterprise_relationship": 16000, "smb_platform": 8000, "smb_local": 8000, "smb_conversion": 8000}', 'Context window sizes for each agent type');

      -- Insert default performance metrics (current month)
      INSERT INTO performance_metrics (date, track, leads_generated, leads_qualified, meetings_scheduled, proposals_sent, deals_closed, revenue_generated) VALUES
      (CURRENT_DATE, 'enterprise', 0, 0, 0, 0, 0, 0.00),
      (CURRENT_DATE, 'smb', 0, 0, 0, 0, 0, 0.00);
    `
  }
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // Create migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get current migration version
    const result = await client.query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
    const currentVersion = result.rows.length > 0 ? result.rows[0].version : 0;

    console.log(`Current database version: ${currentVersion}`);

    // Apply migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Applying migration ${migration.version}: ${migration.name}`);
        
        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
            [migration.version, migration.name]
          );
          await client.query('COMMIT');
          
          console.log(`✓ Migration ${migration.version} applied successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }

    console.log('All migrations completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };