const BaseAgent = require('../baseAgent');

class SMBConversionAgent extends BaseAgent {
  constructor(openai, config = {}) {
    super(openai, config);
    this.agentName = 'SMBConversion';
  }

  getSystemPrompt() {
    return `You are the SMB Conversion Optimizer for rapid small business sales.
    
Focus on price sensitivity analysis, objection handling, and quick-close 
sales processes for volume SMB conversions.`;
  }

  getCapabilities() {
    return ['conversion_optimization', 'objection_handling', 'pricing_strategy', 'quick_close'];
  }

  async executeTask(leadData) {
    const conversionPlan = await this.createConversionPlan(leadData);
    
    return {
      summary: `Conversion plan created for ${leadData.company_name}`,
      plan: conversionPlan,
      duration: 500
    };
  }

  async createConversionPlan(leadData) {
    const prompt = `Create conversion optimization plan for ${leadData.company_name}.`;
    return await this.callOpenAI(this.buildMessages(prompt));
  }
}

module.exports = SMBConversionAgent;