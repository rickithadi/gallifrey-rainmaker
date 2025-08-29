const BaseAgent = require('../baseAgent');
const { query } = require('../../config/database');

class SMBPlatformAgent extends BaseAgent {
  constructor(openai, config = {}) {
    super(openai, config);
    this.agentName = 'SMBPlatform';
  }

  getSystemPrompt() {
    return `You are the SMB Platform Analyst for Gallifrey's "Own Your Narrative" campaign.
    
Analyze platform dependencies, calculate cost savings, and identify quick-win opportunities 
for small-medium businesses to reduce platform fees and improve operational efficiency.`;
  }

  getCapabilities() {
    return ['platform_analysis', 'cost_calculation', 'dependency_assessment', 'roi_analysis'];
  }

  async executeTask(leadData) {
    const analysis = await this.analyzePlatformDependencies(leadData);
    
    await this.storePlatformAnalysis(leadData.id, analysis);
    
    return {
      summary: `Platform analysis completed for ${leadData.company_name}`,
      analysis,
      duration: 800
    };
  }

  async analyzePlatformDependencies(leadData) {
    const prompt = `
Analyze platform dependencies for this Melbourne SMB:

Company: ${leadData.company_name}
Industry: ${leadData.industry}

Identify:
1. Likely platform dependencies (Shopify, Squarespace, etc.)
2. Estimated monthly costs
3. Potential savings opportunities
4. Quick-win alternatives

Provide specific cost calculations and recommendations.
`;

    return await this.callOpenAI(this.buildMessages(prompt));
  }

  async storePlatformAnalysis(leadId, analysis) {
    await query(`
      INSERT INTO platform_analysis (
        company_id, platform_name, monthly_cost, dependency_score, 
        cost_savings_potential, analysis_date
      )
      SELECT c.id, 'analysis', 0, 7, 200, CURRENT_TIMESTAMP
      FROM leads l 
      JOIN companies c ON l.company_id = c.id 
      WHERE l.id = $1
    `, [leadId]);
  }
}

module.exports = SMBPlatformAgent;