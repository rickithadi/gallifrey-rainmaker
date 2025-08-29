const { createPool } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });

// Database connection - works with both Vercel Postgres and regular PostgreSQL
async function getClient() {
  if (process.env.POSTGRES_URL) {
    // Use Vercel Postgres
    const pool = createPool({
      connectionString: process.env.POSTGRES_URL
    });
    return pool;
  } else if (process.env.DATABASE_URL) {
    // Use regular PostgreSQL
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    return pool;
  } else {
    throw new Error('No database connection string found. Set POSTGRES_URL or DATABASE_URL');
  }
}

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
        track VARCHAR(20) NOT NULL CHECK (track IN ('enterprise', 'smb', 'pending_classification')),
        source VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        stage VARCHAR(50) DEFAULT 'lead',
        priority VARCHAR(20) DEFAULT 'medium',
        budget_range VARCHAR(50),
        timeline VARCHAR(50),
        notes TEXT,
        sheet_row_id INTEGER,
        display_priority INTEGER DEFAULT 0,
        classification_confidence DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Agent assignments and tracking (simplified for serverless)
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

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_leads_track ON leads(track);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
      CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads(updated_at);
      CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_agent_activities_created ON agent_activities(created_at);
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
        decision_makers JSONB,
        competitive_landscape TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- SMB-specific data  
      CREATE TABLE IF NOT EXISTS smb_data (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        monthly_platform_cost DECIMAL(10,2),
        platform_dependencies JSONB,
        local_market_presence TEXT,
        urgency_level VARCHAR(20) DEFAULT 'medium',
        quick_win_opportunities TEXT,
        price_sensitivity VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Message templates
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        track VARCHAR(20) NOT NULL CHECK (track IN ('enterprise', 'smb', 'both')),
        category VARCHAR(50),
        subject_line VARCHAR(255),
        body_template TEXT NOT NULL,
        personalization_tags JSONB,
        usage_count INTEGER DEFAULT 0,
        success_rate DECIMAL(3,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Add indexes
      CREATE INDEX IF NOT EXISTS idx_enterprise_data_company ON enterprise_data(company_id);
      CREATE INDEX IF NOT EXISTS idx_smb_data_company ON smb_data(company_id);
      CREATE INDEX IF NOT EXISTS idx_templates_track ON message_templates(track);
    `
  },
  {
    version: 3,
    name: 'insert_sample_data',
    sql: `
      -- Insert default message templates
      INSERT INTO message_templates (name, track, category, subject_line, body_template, personalization_tags) VALUES
      ('Enterprise Initial Outreach', 'enterprise', 'initial', 'Security Assessment for {company_name}', 
       'Hi {contact_name},\n\nI noticed {company_name} operates in the {industry} sector with significant security needs.\n\nWe help companies reduce security risks while improving efficiency. I''d like to share a brief assessment.\n\nWould you be open to a 15-minute conversation?\n\nBest regards,\n{sender_name}',
       '["company_name", "contact_name", "industry", "sender_name"]'),
      
      ('SMB Platform Risk Alert', 'smb', 'urgency', 'Platform Cost Analysis for {company_name}', 
       'Hi {contact_name},\n\nI was reviewing Melbourne businesses and noticed {company_name} might have opportunities to reduce platform costs.\n\nI''ve helped similar businesses save around {potential_savings}/month.\n\nWould a brief 10-minute call be valuable?\n\nCheers,\n{sender_name}',
       '["company_name", "contact_name", "potential_savings", "sender_name"]');

      -- Insert sample companies for testing
      INSERT INTO companies (name, industry, employee_count, website) VALUES
      ('Demo Tech Corp', 'Technology', 150, 'demotechcorp.com'),
      ('Melbourne Local Cafe', 'Food & Beverage', 8, 'melbournecafe.com.au')
      ON CONFLICT DO NOTHING;

      -- Insert sample contacts
      INSERT INTO contacts (company_id, first_name, last_name, email) VALUES
      ((SELECT id FROM companies WHERE name = 'Demo Tech Corp'), 'John', 'Smith', 'john@demotechcorp.com'),
      ((SELECT id FROM companies WHERE name = 'Melbourne Local Cafe'), 'Sarah', 'Johnson', 'sarah@melbournecafe.com.au')
      ON CONFLICT (email) DO NOTHING;
    `
  }
];

async function runMigrations() {
  const client = await getClient();
  
  try {
    console.log('🔄 Running database migrations...');

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

    console.log(`📊 Current database version: ${currentVersion}`);

    // Apply migrations
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`⚡ Applying migration ${migration.version}: ${migration.name}`);
        
        try {
          await client.query('BEGIN');
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
            [migration.version, migration.name]
          );
          await client.query('COMMIT');
          
          console.log(`✅ Migration ${migration.version} applied successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client.end) {
      await client.end();
    }
  }
}

if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };