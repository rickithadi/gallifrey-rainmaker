const BaseAgent = require('../baseAgent');
const axios = require('axios');
const { query } = require('../../config/database');
const { agentLogger } = require('../../utils/logger');

class EnterpriseResearchAgent extends BaseAgent {
  constructor(openai, config = {}) {
    super(openai, config);
    this.agentName = 'EnterpriseResearch';
  }

  getSystemPrompt() {
    return `You are the Enterprise Research Specialist for Gallifrey Consulting's marketing automation system.

Your expertise includes:
- Deep B2B company intelligence and analysis
- Security posture assessment and vulnerability identification  
- Technical infrastructure evaluation
- Compliance gap analysis (SOC2, ISO27001, GDPR, etc.)
- Competitive landscape assessment
- Stakeholder mapping and decision-maker identification
- Technical debt and modernization opportunity identification

Your role is to research enterprise prospects thoroughly and identify:
1. Security vulnerabilities and compliance gaps
2. Technical modernization opportunities  
3. Key stakeholders and decision makers
4. Competitive threats and positioning opportunities
5. Budget and timeline indicators
6. Procurement processes and approval workflows

Always provide actionable insights that can be used by content and relationship management agents.
Focus on high-value opportunities that justify enterprise-level engagements.
Include specific, measurable findings with supporting evidence.`;
  }

  getCapabilities() {
    return [
      'company_research',
      'security_analysis', 
      'compliance_assessment',
      'stakeholder_mapping',
      'competitive_analysis',
      'technical_evaluation'
    ];
  }

  async executeTask(leadData) {
    const startTime = Date.now();
    
    try {
      agentLogger.info(`${this.agentName}_${this.instanceId} executing enterprise research`, {
        company: leadData.company_name,
        industry: leadData.industry
      });

      // Parallel research execution
      const [
        companyIntel,
        securityAssessment,
        stakeholderMap,
        competitiveAnalysis,
        technicalEvaluation
      ] = await Promise.all([
        this.performCompanyIntelligence(leadData),
        this.assessSecurityPosture(leadData),
        this.mapStakeholders(leadData),
        this.analyzeCompetitiveLandscape(leadData),
        this.evaluateTechnicalInfrastructure(leadData)
      ]);

      // Synthesize findings
      const synthesis = await this.synthesizeFindings({
        companyIntel,
        securityAssessment,
        stakeholderMap,
        competitiveAnalysis,  
        technicalEvaluation
      }, leadData);

      // Store research data
      await this.storeResearchData(leadData.id, {
        companyIntel,
        securityAssessment,
        stakeholderMap,
        competitiveAnalysis,
        technicalEvaluation,
        synthesis
      });

      // Update lead priority based on findings
      await this.updateLeadPriority(leadData.id, synthesis);

      const duration = Date.now() - startTime;

      return {
        summary: `Enterprise research completed for ${leadData.company_name}`,
        findings: {
          companyIntel,
          securityAssessment, 
          stakeholderMap,
          competitiveAnalysis,
          technicalEvaluation
        },
        synthesis,
        recommendations: synthesis.recommendations,
        nextActions: synthesis.nextActions,
        duration
      };

    } catch (error) {
      agentLogger.error(`${this.agentName}_${this.instanceId} research failed`, {
        company: leadData.company_name,
        error: error.message
      });
      throw error;
    }
  }

  async performCompanyIntelligence(leadData) {
    const prompt = `
Analyze this enterprise prospect for business intelligence:

Company: ${leadData.company_name}
Industry: ${leadData.industry || 'Unknown'}
Website: ${leadData.website || 'Unknown'} 
Employee Count: ${leadData.employee_count || 'Unknown'}
Location: ${leadData.location || 'Unknown'}
Revenue Range: ${leadData.revenue_range || 'Unknown'}

Research Focus:
1. Business model and revenue streams
2. Growth stage and funding status
3. Technology adoption patterns
4. Regulatory environment
5. Recent news, acquisitions, or strategic changes
6. Budget cycles and procurement processes

Provide specific, actionable intelligence that helps position our security and compliance services.
Include confidence levels for your assessments.
`;

    const intelligence = await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 800,
      temperature: 0.2
    });

    // Parse intelligence and structure data
    return {
      analysis: intelligence,
      confidence: this.extractConfidence(intelligence),
      keyInsights: this.extractKeyInsights(intelligence),
      businessModel: this.extractBusinessModel(intelligence),
      growthStage: this.extractGrowthStage(intelligence)
    };
  }

  async assessSecurityPosture(leadData) {
    const prompt = `
Assess the security posture for this enterprise prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry || 'Unknown'}
Website: ${leadData.website || 'Unknown'}
Existing Security Requirements: ${leadData.security_requirements || 'Unknown'}
Compliance Needs: ${leadData.compliance_needs || 'Unknown'}

Assessment Areas:
1. Industry-specific security requirements and threats
2. Likely compliance frameworks (SOC2, ISO27001, GDPR, HIPAA, PCI-DSS)
3. Common vulnerabilities for companies in this industry/size
4. Regulatory pressure and audit requirements
5. Potential security gaps based on company profile
6. Modernization opportunities

Rate each area (High/Medium/Low risk) and provide specific recommendations.
Focus on actionable findings that demonstrate immediate value.
`;

    const assessment = await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 1000,
      temperature: 0.1
    });

    return {
      assessment,
      riskLevel: this.extractRiskLevel(assessment),
      complianceGaps: this.extractComplianceGaps(assessment),
      vulnerabilities: this.extractVulnerabilities(assessment),
      recommendations: this.extractSecurityRecommendations(assessment)
    };
  }

  async mapStakeholders(leadData) {
    const prompt = `
Map key stakeholders for this enterprise prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry || 'Unknown'}
Employee Count: ${leadData.employee_count || 'Unknown'}
Primary Contact: ${leadData.first_name} ${leadData.last_name}
Title: ${leadData.title || 'Unknown'}

Stakeholder Mapping:
1. Decision makers for security/compliance projects
2. Technical evaluators and influencers  
3. Budget holders and procurement contacts
4. Implementation team members
5. Typical approval process for this company size/industry
6. Potential internal champions and skeptics

For each stakeholder type, identify:
- Likely titles and departments
- Key concerns and motivations
- Preferred communication styles
- Decision-making authority level
`;

    const stakeholderMap = await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 800,
      temperature: 0.3
    });

    return {
      map: stakeholderMap,
      decisionMakers: this.extractDecisionMakers(stakeholderMap),
      influencers: this.extractInfluencers(stakeholderMap),
      approvalProcess: this.extractApprovalProcess(stakeholderMap),
      champions: this.extractPotentialChampions(stakeholderMap)
    };
  }

  async analyzeCompetitiveLandscape(leadData) {
    const prompt = `
Analyze the competitive landscape for this enterprise prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry || 'Unknown'}
Company Description: ${leadData.company_description || 'Unknown'}

Competitive Analysis:
1. Current security/compliance vendors they likely use
2. Incumbent solutions and potential lock-in factors
3. Recent industry trends affecting security decisions
4. Competitive threats to their business
5. Technology stack and integration requirements
6. Switching costs and migration challenges

Provide positioning opportunities for Gallifrey Consulting:
- Unique differentiators we can leverage
- Competitor weaknesses to exploit  
- Market timing advantages
- Value propositions that resonate
`;

    const analysis = await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 800,
      temperature: 0.3
    });

    return {
      analysis,
      currentVendors: this.extractCurrentVendors(analysis),
      competitorWeaknesses: this.extractCompetitorWeaknesses(analysis),
      positioningOpportunities: this.extractPositioningOpportunities(analysis),
      differentiators: this.extractDifferentiators(analysis)
    };
  }

  async evaluateTechnicalInfrastructure(leadData) {
    const prompt = `
Evaluate technical infrastructure for this enterprise prospect:

Company: ${leadData.company_name}
Industry: ${leadData.industry || 'Unknown'}
Website: ${leadData.website || 'Unknown'}
Technical Stack: ${leadData.technical_stack || 'Unknown'}

Technical Evaluation:
1. Likely cloud infrastructure (AWS, Azure, GCP)
2. Application architecture patterns
3. Data storage and processing needs
4. Integration requirements and APIs
5. Scalability and performance challenges
6. Technical debt and modernization needs
7. DevOps maturity and automation level

Focus on identifying:
- Security architecture gaps
- Compliance automation opportunities  
- Infrastructure modernization needs
- Integration and migration complexity
`;

    const evaluation = await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 800,
      temperature: 0.2
    });

    return {
      evaluation,
      cloudInfrastructure: this.extractCloudInfrastructure(evaluation),
      architectureGaps: this.extractArchitectureGaps(evaluation),
      modernizationOpportunities: this.extractModernizationOpportunities(evaluation),
      integrationComplexity: this.extractIntegrationComplexity(evaluation)
    };
  }

  async synthesizeFindings(findings, leadData) {
    const prompt = `
Synthesize these enterprise research findings into actionable insights:

Company: ${leadData.company_name}

Research Findings:
1. Company Intelligence: ${JSON.stringify(findings.companyIntel).substring(0, 500)}
2. Security Assessment: ${JSON.stringify(findings.securityAssessment).substring(0, 500)}
3. Stakeholder Map: ${JSON.stringify(findings.stakeholderMap).substring(0, 500)}
4. Competitive Analysis: ${JSON.stringify(findings.competitiveAnalysis).substring(0, 500)}
5. Technical Evaluation: ${JSON.stringify(findings.technicalEvaluation).substring(0, 500)}

Synthesis Requirements:
1. Overall opportunity score (1-10)
2. Primary value propositions (top 3)
3. Key risks and objections
4. Recommended engagement strategy
5. Timeline and budget estimates
6. Success probability assessment
7. Next actions for content and relationship agents

Provide a concise executive summary with specific, actionable recommendations.
`;

    const synthesis = await this.callOpenAI(this.buildMessages(prompt), {
      maxTokens: 1000,
      temperature: 0.3
    });

    return {
      synthesis,
      opportunityScore: this.extractOpportunityScore(synthesis),
      valuePropositions: this.extractValuePropositions(synthesis),
      risks: this.extractRisks(synthesis),
      strategy: this.extractStrategy(synthesis),
      timeline: this.extractTimeline(synthesis),
      recommendations: this.extractRecommendations(synthesis),
      nextActions: this.extractNextActions(synthesis)
    };
  }

  // Helper methods for extracting structured data from AI responses
  extractConfidence(text) {
    const match = text.match(/confidence[:\s]+(\d+)%?/i);
    return match ? parseInt(match[1]) : 70;
  }

  extractOpportunityScore(text) {
    const match = text.match(/score[:\s]+(\d+)(?:\/10)?/i);
    return match ? parseInt(match[1]) : 5;
  }

  extractKeyInsights(text) {
    const insights = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.match(/^[-•]\s+/) || line.match(/^\d+\.\s+/)) {
        insights.push(line.replace(/^[-•\d.\s]+/, '').trim());
      }
    }
    
    return insights.slice(0, 5); // Top 5 insights
  }

  extractBusinessModel(text) {
    const match = text.match(/business model[:\s]+(.*?)(?:\n|$)/i);
    return match ? match[1].trim() : 'Unknown';
  }

  extractGrowthStage(text) {
    const stages = ['startup', 'growth', 'scale', 'mature'];
    for (const stage of stages) {
      if (text.toLowerCase().includes(stage)) {
        return stage;
      }
    }
    return 'unknown';
  }

  extractRiskLevel(text) {
    if (text.toLowerCase().includes('high risk')) return 'high';
    if (text.toLowerCase().includes('medium risk')) return 'medium';
    if (text.toLowerCase().includes('low risk')) return 'low';
    return 'medium';
  }

  extractComplianceGaps(text) {
    const gaps = [];
    const frameworks = ['SOC2', 'ISO27001', 'GDPR', 'HIPAA', 'PCI-DSS'];
    
    for (const framework of frameworks) {
      if (text.includes(framework) && text.toLowerCase().includes('gap')) {
        gaps.push(framework);
      }
    }
    
    return gaps;
  }

  extractDecisionMakers(text) {
    const titles = ['CTO', 'CISO', 'CIO', 'VP', 'Director', 'Head'];
    const decisionMakers = [];
    
    for (const title of titles) {
      if (text.includes(title)) {
        decisionMakers.push(title);
      }
    }
    
    return decisionMakers;
  }

  // Store research data in database
  async storeResearchData(leadId, researchData) {
    try {
      // Update or insert enterprise data
      await query(`
        INSERT INTO enterprise_data (
          company_id, 
          competitive_landscape, 
          updated_at
        )
        SELECT 
          c.id,
          $2,
          CURRENT_TIMESTAMP
        FROM leads l
        JOIN companies c ON l.company_id = c.id
        WHERE l.id = $1
        ON CONFLICT (company_id) 
        DO UPDATE SET 
          competitive_landscape = EXCLUDED.competitive_landscape,
          updated_at = CURRENT_TIMESTAMP
      `, [leadId, JSON.stringify(researchData)]);

      agentLogger.info(`${this.agentName}_${this.instanceId} stored research data`, { leadId });
      
    } catch (error) {
      agentLogger.error(`Failed to store research data for lead ${leadId}:`, error);
      throw error;
    }
  }

  async updateLeadPriority(leadId, synthesis) {
    try {
      const priority = synthesis.opportunityScore >= 8 ? 'high' : 
                     synthesis.opportunityScore >= 6 ? 'medium' : 'low';

      await query(`
        UPDATE leads 
        SET priority = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [priority, leadId]);

    } catch (error) {
      agentLogger.error(`Failed to update lead priority for ${leadId}:`, error);
    }
  }

  // Additional helper methods for extraction
  extractVulnerabilities(text) {
    const vulnerabilities = [];
    const commonVulns = ['data breach', 'insider threat', 'ransomware', 'compliance violation'];
    
    for (const vuln of commonVulns) {
      if (text.toLowerCase().includes(vuln)) {
        vulnerabilities.push(vuln);
      }
    }
    
    return vulnerabilities;
  }

  extractSecurityRecommendations(text) {
    return this.extractKeyInsights(text).filter(insight => 
      insight.toLowerCase().includes('recommend') || 
      insight.toLowerCase().includes('should') ||
      insight.toLowerCase().includes('implement')
    );
  }

  extractInfluencers(text) {
    const influencerTitles = ['Architect', 'Manager', 'Lead', 'Senior'];
    return influencerTitles.filter(title => text.includes(title));
  }

  extractApprovalProcess(text) {
    const match = text.match(/approval[:\s]+(.*?)(?:\n|$)/i);
    return match ? match[1].trim() : 'Standard enterprise process';
  }

  extractPotentialChampions(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('champion') ||
      insight.toLowerCase().includes('advocate') ||
      insight.toLowerCase().includes('supporter')
    );
  }

  extractCurrentVendors(text) {
    const vendors = ['AWS', 'Microsoft', 'Google', 'Okta', 'Splunk', 'CrowdStrike'];
    return vendors.filter(vendor => text.includes(vendor));
  }

  extractCompetitorWeaknesses(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('weakness') ||
      insight.toLowerCase().includes('gap') ||
      insight.toLowerCase().includes('limitation')
    );
  }

  extractPositioningOpportunities(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('opportunity') ||
      insight.toLowerCase().includes('advantage') ||
      insight.toLowerCase().includes('differentiator')
    );
  }

  extractDifferentiators(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('unique') ||
      insight.toLowerCase().includes('differentiator') ||
      insight.toLowerCase().includes('competitive advantage')
    );
  }

  extractCloudInfrastructure(text) {
    const clouds = ['AWS', 'Azure', 'GCP', 'Google Cloud'];
    return clouds.filter(cloud => text.includes(cloud));
  }

  extractArchitectureGaps(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('gap') ||
      insight.toLowerCase().includes('missing') ||
      insight.toLowerCase().includes('lacking')
    );
  }

  extractModernizationOpportunities(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('moderniz') ||
      insight.toLowerCase().includes('upgrade') ||
      insight.toLowerCase().includes('migrate')
    );
  }

  extractIntegrationComplexity(text) {
    if (text.toLowerCase().includes('complex')) return 'high';
    if (text.toLowerCase().includes('moderate')) return 'medium';
    if (text.toLowerCase().includes('simple')) return 'low';
    return 'medium';
  }

  extractValuePropositions(text) {
    return this.extractKeyInsights(text).filter((insight, index) => index < 3);
  }

  extractRisks(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('risk') ||
      insight.toLowerCase().includes('challenge') ||
      insight.toLowerCase().includes('concern')
    );
  }

  extractStrategy(text) {
    const match = text.match(/strategy[:\s]+(.*?)(?:\n|$)/i);
    return match ? match[1].trim() : 'Direct executive engagement';
  }

  extractTimeline(text) {
    const match = text.match(/timeline[:\s]+(.*?)(?:\n|$)/i);
    return match ? match[1].trim() : '3-6 months';
  }

  extractRecommendations(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('recommend') ||
      insight.toLowerCase().includes('should') ||
      insight.toLowerCase().includes('suggest')
    );
  }

  extractNextActions(text) {
    return this.extractKeyInsights(text).filter(insight =>
      insight.toLowerCase().includes('next') ||
      insight.toLowerCase().includes('action') ||
      insight.toLowerCase().includes('follow')
    );
  }
}

module.exports = EnterpriseResearchAgent;