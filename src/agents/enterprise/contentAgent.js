const BaseAgent = require('../baseAgent');
const { query } = require('../../config/database');
const { agentLogger } = require('../../utils/logger');

class EnterpriseContentAgent extends BaseAgent {
  constructor(openai, config = {}) {
    super(openai, config);
    this.agentName = 'EnterpriseContent';
  }

  getSystemPrompt() {
    return `You are the Enterprise Content Strategist for Gallifrey Consulting's marketing automation system.

Your expertise includes:
- Technical thought leadership and authority building
- Security and compliance content creation
- Industry-specific case studies and whitepapers
- Executive-level business communications
- Technical documentation and assessments
- Risk analysis and compliance reports

Create compelling, authoritative content that positions Gallifrey as the trusted security and compliance partner for enterprise prospects.`;
  }

  getCapabilities() {
    return [
      'technical_content_creation',
      'thought_leadership',
      'case_study_development',
      'executive_communications',
      'risk_assessments',
      'compliance_documentation'
    ];
  }

  async executeTask(leadData) {
    const startTime = Date.now();
    
    try {
      // Get research insights from Research Agent
      const researchInsights = await this.getResearchInsights(leadData.id);
      
      // Create targeted content based on research
      const [
        executiveSummary,
        technicalAssessment,
        caseStudy,
        followUpContent
      ] = await Promise.all([
        this.createExecutiveSummary(leadData, researchInsights),
        this.createTechnicalAssessment(leadData, researchInsights),
        this.selectRelevantCaseStudy(leadData, researchInsights),
        this.generateFollowUpContent(leadData, researchInsights)
      ]);

      // Store content
      await this.storeContent(leadData.id, {
        executiveSummary,
        technicalAssessment,
        caseStudy,
        followUpContent
      });

      const duration = Date.now() - startTime;

      return {
        summary: `Enterprise content created for ${leadData.company_name}`,
        content: {
          executiveSummary,
          technicalAssessment,
          caseStudy,
          followUpContent
        },
        duration
      };

    } catch (error) {
      agentLogger.error(`${this.agentName}_${this.instanceId} content creation failed`, {
        company: leadData.company_name,
        error: error.message
      });
      throw error;
    }
  }

  async getResearchInsights(leadId) {
    const result = await query(`
      SELECT output_data 
      FROM agent_activities aa
      JOIN agent_assignments ag ON aa.agent_assignment_id = ag.id
      WHERE aa.lead_id = $1 
        AND ag.agent_type = 'enterprise_research'
        AND aa.status = 'success'
      ORDER BY aa.created_at DESC
      LIMIT 1
    `, [leadId]);

    return result.rows[0]?.output_data || {};
  }

  async createExecutiveSummary(leadData, insights) {
    const prompt = `
Create an executive summary for this enterprise prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry}
Research Insights: ${JSON.stringify(insights).substring(0, 1000)}

Create a compelling 1-page executive summary that:
1. Acknowledges their industry challenges
2. Highlights specific security/compliance risks
3. Positions our expertise and solutions
4. Includes relevant case study reference
5. Calls for executive-level discussion

Tone: Professional, authoritative, consultative
Format: Executive memo style
`;

    return await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 800,
      temperature: 0.3
    });
  }

  async createTechnicalAssessment(leadData, insights) {
    const prompt = `
Create a technical assessment overview for this enterprise prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry}
Technical Insights: ${JSON.stringify(insights).substring(0, 1000)}

Create a technical assessment that:
1. Identifies likely security architecture gaps
2. Highlights compliance automation opportunities
3. Outlines modernization recommendations
4. Provides ROI projections
5. Suggests implementation roadmap

Tone: Technical but accessible to executives
Focus: Actionable recommendations with business impact
`;

    return await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 1000,
      temperature: 0.2
    });
  }

  async selectRelevantCaseStudy(leadData, insights) {
    // In a real implementation, this would select from a database of case studies
    const prompt = `
Recommend the most relevant case study for this prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry}
Company Size: ${leadData.employee_count} employees

Select and customize a case study that:
1. Matches their industry or similar use case
2. Addresses their likely security/compliance challenges
3. Demonstrates measurable business outcomes
4. Shows successful executive partnership

Provide the case study recommendation with customization notes.
`;

    return await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 600,
      temperature: 0.3
    });
  }

  async generateFollowUpContent(leadData, insights) {
    const prompt = `
Generate follow-up content sequence for this enterprise prospect:

Company: ${leadData.company_name}
Research Findings: ${JSON.stringify(insights).substring(0, 800)}

Create a 3-touch follow-up sequence:
1. Initial value-add content piece
2. Industry insight/trend analysis
3. Personalized risk assessment invitation

Each piece should build authority and move toward a discovery conversation.
Include subject lines and key talking points.
`;

    return await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 1000,
      temperature: 0.4
    });
  }

  async storeContent(leadId, content) {
    try {
      await query(`
        INSERT INTO communications (
          lead_id, type, direction, subject, content, 
          template_used, sent_by, status, created_at
        )
        VALUES ($1, 'content_package', 'outbound', $2, $3, 'enterprise_content_package', $4, 'ready', CURRENT_TIMESTAMP)
      `, [
        leadId,
        `Enterprise Content Package - ${new Date().toLocaleDateString()}`,
        JSON.stringify(content),
        `${this.agentName}_${this.instanceId}`
      ]);

    } catch (error) {
      agentLogger.error(`Failed to store content for lead ${leadId}:`, error);
      throw error;
    }
  }
}

module.exports = EnterpriseContentAgent;