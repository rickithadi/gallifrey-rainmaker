import OpenAI from 'openai';
import { query } from './db';
import { kv } from '@vercel/kv';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cache management using Vercel KV or memory fallback
class CacheManager {
  async get(key: string) {
    if (process.env.KV_URL) {
      return await kv.get(key);
    }
    // Memory fallback for development
    return null;
  }
  
  async set(key: string, value: any, ttl: number = 3600) {
    if (process.env.KV_URL) {
      return await kv.set(key, value, { ex: ttl });
    }
    // Memory fallback - just return for development
    return value;
  }
}

const cache = new CacheManager();

// Agent types and configurations
export const AGENT_CONFIGS = {
  enterprise_research: {
    contextSize: 16000,
    systemPrompt: `You are the Enterprise Research Specialist for Gallifrey Consulting's marketing automation system.

Your expertise includes:
- Deep B2B company intelligence and analysis
- Security posture assessment and vulnerability identification  
- Technical infrastructure evaluation
- Compliance gap analysis (SOC2, ISO27001, GDPR, etc.)
- Competitive landscape assessment
- Stakeholder mapping and decision-maker identification

Always provide actionable insights with specific, measurable findings.`
  },
  
  enterprise_content: {
    contextSize: 16000,
    systemPrompt: `You are the Enterprise Content Strategist for Gallifrey Consulting.

Your expertise includes:
- Technical thought leadership and authority building
- Security and compliance content creation
- Industry-specific case studies and whitepapers
- Executive-level business communications

Create compelling, authoritative content that positions Gallifrey as the trusted security partner.`
  },
  
  enterprise_relationship: {
    contextSize: 16000,
    systemPrompt: `You are the Enterprise Relationship Manager for Gallifrey Consulting.

Manage complex B2B relationships, coordinate multi-stakeholder communications, 
and orchestrate long-term nurture sequences for high-value enterprise prospects.`
  },
  
  smb_platform: {
    contextSize: 8000,
    systemPrompt: `You are the SMB Platform Analyst for Gallifrey's "Own Your Narrative" campaign.

Analyze platform dependencies, calculate cost savings, and identify quick-win opportunities 
for small-medium businesses to reduce platform fees and improve operational efficiency.`
  },
  
  smb_local: {
    contextSize: 8000,
    systemPrompt: `You are the SMB Local Outreach Specialist for Melbourne-based businesses.

Focus on local market intelligence, community engagement, and Melbourne-specific 
business opportunities and challenges.`
  },
  
  smb_conversion: {
    contextSize: 8000,
    systemPrompt: `You are the SMB Conversion Optimizer for rapid small business sales.

Focus on price sensitivity analysis, objection handling, and quick-close 
sales processes for volume SMB conversions.`
  }
};

// Lead classification function
export async function classifyLead(leadData: any) {
  const cacheKey = `classification:${leadData.id}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) {
    return cached;
  }

  const classificationPrompt = `
Lead Information:
- Company: ${leadData.company_name}
- Industry: ${leadData.industry || 'Unknown'}
- Employees: ${leadData.employee_count || 'Unknown'}
- Website: ${leadData.website || 'None'}
- Contact: ${leadData.first_name} ${leadData.last_name}
- Title: ${leadData.title || 'Unknown'}
- Email: ${leadData.email}
- Notes: ${leadData.notes || 'None'}

ENTERPRISE TRACK criteria:
- Companies with 50+ employees
- Annual revenue > $5M
- Complex security/compliance requirements
- Long sales cycles acceptable
- High-value potential deals

SMB TRACK criteria:
- Companies with < 50 employees
- Local Melbourne businesses
- Platform dependency issues
- Quick decision making needed
- Volume-based approach

Respond with JSON: {"track": "enterprise|smb", "confidence": 0.0-1.0, "reasoning": "explanation", "priority": "high|medium|low"}
  `.trim();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are the Master Coordinator for Gallifrey's dual-track marketing system. 
                   Your job is to classify leads as either 'enterprise' or 'smb' track based on the provided data.`
        },
        {
          role: 'user',
          content: classificationPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 300
    });

    const classificationText = response.choices[0].message.content?.trim();
    let classification;
    
    try {
      classification = JSON.parse(classificationText || '{}');
    } catch (parseError) {
      // Fallback classification logic
      classification = fallbackClassification(leadData);
    }

    // Cache for 1 hour
    await cache.set(cacheKey, classification, 3600);
    
    return classification;
    
  } catch (error) {
    console.error('OpenAI classification failed:', error);
    return fallbackClassification(leadData);
  }
}

function fallbackClassification(leadData: any) {
  let track = 'smb';
  let confidence = 0.60;
  let priority = 'medium';
  const reasoning = 'Fallback rule-based classification';

  if (leadData.employee_count && leadData.employee_count >= 50) {
    track = 'enterprise';
    confidence = 0.75;
  }

  if (leadData.industry && ['technology', 'finance', 'healthcare'].includes(leadData.industry.toLowerCase())) {
    track = 'enterprise';
    confidence = Math.min(confidence + 0.1, 0.85);
  }

  if (leadData.title && ['cto', 'ciso', 'vp', 'director', 'head'].some(title => 
      leadData.title.toLowerCase().includes(title))) {
    track = 'enterprise';
    confidence = Math.min(confidence + 0.1, 0.90);
    priority = 'high';
  }

  return { track, confidence, priority, reasoning };
}

// Agent execution function
export async function executeAgent(agentType: string, leadData: any, action: string = 'process_lead') {
  const config = AGENT_CONFIGS[agentType as keyof typeof AGENT_CONFIGS];
  if (!config) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  const cacheKey = `agent:${agentType}:${leadData.id}:${action}`;
  const cached = await cache.get(cacheKey);
  
  if (cached && typeof cached === 'object' && 'timestamp' in cached && 'result' in cached) {
    if (Date.now() - (cached as any).timestamp < 30 * 60 * 1000) { // 30 min cache
      return (cached as any).result;
    }
  }

  try {
    let prompt = '';
    
    switch (agentType) {
      case 'enterprise_research':
        prompt = buildEnterpriseResearchPrompt(leadData);
        break;
      case 'enterprise_content':
        prompt = buildEnterpriseContentPrompt(leadData);
        break;
      case 'smb_platform':
        prompt = buildSMBPlatformPrompt(leadData);
        break;
      case 'smb_local':
        prompt = buildSMBLocalPrompt(leadData);
        break;
      default:
        prompt = `Analyze this prospect and provide actionable insights:\n\nCompany: ${leadData.company_name}\nIndustry: ${leadData.industry}`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: config.systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const result = {
      summary: `${agentType} analysis completed for ${leadData.company_name}`,
      analysis: response.choices[0].message.content,
      recommendations: extractRecommendations(response.choices[0].message.content || ''),
      confidence: 0.85,
      timestamp: Date.now()
    };

    // Cache for 30 minutes
    await cache.set(cacheKey, { result, timestamp: Date.now() }, 1800);
    
    // Log activity
    await logAgentActivity(leadData.id, agentType, action, result, 'success');
    
    return result;
    
  } catch (error) {
    console.error(`Agent ${agentType} execution failed:`, error);
    
    await logAgentActivity(leadData.id, agentType, action, { error: (error as Error).message }, 'error');
    
    throw error;
  }
}

function buildEnterpriseResearchPrompt(leadData: any) {
  return `
Analyze this enterprise prospect for business intelligence:

Company: ${leadData.company_name}
Industry: ${leadData.industry || 'Unknown'}
Website: ${leadData.website || 'Unknown'} 
Employee Count: ${leadData.employee_count || 'Unknown'}
Revenue Range: ${leadData.revenue_range || 'Unknown'}

Research Focus:
1. Business model and revenue streams
2. Security posture and compliance needs
3. Technology adoption patterns
4. Key stakeholders and decision makers
5. Competitive threats and positioning opportunities

Provide specific, actionable intelligence with confidence levels.
  `.trim();
}

function buildEnterpriseContentPrompt(leadData: any) {
  return `
Create executive-level content for this enterprise prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry}

Create:
1. Executive summary highlighting their industry challenges
2. Security/compliance risk assessment overview
3. ROI projections for addressing gaps
4. Call-to-action for executive discussion

Tone: Professional, authoritative, consultative
  `.trim();
}

function buildSMBPlatformPrompt(leadData: any) {
  return `
Analyze platform dependencies for this Melbourne SMB:

Company: ${leadData.company_name}
Industry: ${leadData.industry}

Identify:
1. Likely platform dependencies (Shopify, Squarespace, etc.)
2. Estimated monthly costs
3. Potential savings opportunities
4. Quick-win alternatives

Provide specific cost calculations and recommendations.
  `.trim();
}

function buildSMBLocalPrompt(leadData: any) {
  return `
Analyze local Melbourne business opportunity:

Company: ${leadData.company_name}
Industry: ${leadData.industry}

Focus on:
1. Local market position and competitors
2. Community engagement opportunities
3. Melbourne-specific business challenges
4. Networking and partnership potential

Provide locally-relevant insights and action items.
  `.trim();
}

function extractRecommendations(text: string): string[] {
  const recommendations = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.match(/^[-•]\s+/) || line.match(/^\d+\.\s+/)) {
      const rec = line.replace(/^[-•\d.\s]+/, '').trim();
      if (rec.toLowerCase().includes('recommend') || 
          rec.toLowerCase().includes('should') ||
          rec.toLowerCase().includes('suggest')) {
        recommendations.push(rec);
      }
    }
  }
  
  return recommendations.slice(0, 5); // Top 5 recommendations
}

async function logAgentActivity(leadId: number, agentType: string, action: string, result: any, status: 'success' | 'error') {
  try {
    await query(`
      INSERT INTO agent_activities (
        lead_id, activity_type, description, output_data, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      leadId,
      `${agentType}_${action}`,
      result.summary || 'Agent activity',
      JSON.stringify(result),
      status
    ]);
  } catch (error) {
    console.error('Failed to log agent activity:', error);
  }
}

// Get agent status for monitoring
export async function getAgentStatus() {
  try {
    const result = await query(`
      SELECT 
        agent_type,
        agent_name,
        status,
        assigned_at,
        last_activity,
        performance_score,
        task_queue_length
      FROM agent_assignments
      WHERE status = 'active'
      ORDER BY agent_type, agent_name
    `);

    const agentStatus = (result.rows as any[]).reduce((acc: any, row) => {
      if (!acc[row.agent_type]) {
        acc[row.agent_type] = [];
      }
      acc[row.agent_type].push({
        name: row.agent_name,
        status: row.status,
        lastActivity: row.last_activity,
        performance: row.performance_score,
        queueLength: row.task_queue_length
      });
      return acc;
    }, {});

    return agentStatus;
  } catch (error) {
    console.error('Failed to get agent status:', error);
    return {};
  }
}