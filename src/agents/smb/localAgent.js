const BaseAgent = require('../baseAgent');

class SMBLocalAgent extends BaseAgent {
  constructor(openai, config = {}) {
    super(openai, config);
    this.agentName = 'SMBLocal';
  }

  getSystemPrompt() {
    return `You are the SMB Local Outreach Specialist for Melbourne-based businesses.
    
Focus on local market intelligence, community engagement, and Melbourne-specific 
business opportunities and challenges.`;
  }

  getCapabilities() {
    return ['local_outreach', 'community_engagement', 'melbourne_market_intelligence'];
  }

  async executeTask(leadData) {
    const localAnalysis = await this.analyzeLocalOpportunity(leadData);
    
    return {
      summary: `Local analysis completed for ${leadData.company_name}`,
      analysis: localAnalysis,
      duration: 600
    };
  }

  async analyzeLocalOpportunity(leadData) {
    const prompt = `Analyze local Melbourne business opportunity for ${leadData.company_name} in ${leadData.industry}.`;
    return await this.callOpenAI(this.buildMessages(prompt));
  }
}

module.exports = SMBLocalAgent;