const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

class EnterprisePipelineAnalyzer {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  }

  async authenticate() {
    this.auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    await this.auth.authorize();
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    console.log('✅ Connected to Google Sheets');
  }

  async analyzeEnterprisePipeline() {
    console.log('🔍 Analyzing current Enterprise Pipeline...');

    try {
      // Get the Enterprise Pipeline sheet structure
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const enterpriseSheet = response.data.sheets.find(s => 
        s.properties.title.toLowerCase().includes('enterprise')
      );

      if (!enterpriseSheet) {
        console.log('❌ No Enterprise Pipeline sheet found');
        return null;
      }

      console.log(`📊 Found: ${enterpriseSheet.properties.title}`);

      // Get current data and structure
      const dataResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${enterpriseSheet.properties.title}!A1:Z50`
      });

      const data = dataResponse.data.values || [];
      const headers = data[0] || [];
      const records = data.slice(1).filter(row => row.some(cell => cell && cell.trim()));

      console.log(`📋 Current structure: ${headers.length} columns, ${records.length} records`);
      console.log('📌 Headers:', headers.slice(0, 10).join(', ') + (headers.length > 10 ? '...' : ''));

      // Analyze what we have vs what we need
      const analysis = this.analyzeStructure(headers, records);
      
      return {
        sheetName: enterpriseSheet.properties.title,
        sheetId: enterpriseSheet.properties.sheetId,
        headers,
        records,
        analysis
      };

    } catch (error) {
      console.error('❌ Error analyzing Enterprise Pipeline:', error.message);
      return null;
    }
  }

  analyzeStructure(headers, records) {
    const analysis = {
      hasBasicInfo: false,
      hasStageTracking: false,
      hasValueTracking: false,
      hasContactInfo: false,
      hasActivityTracking: false,
      hasNurturing: false,
      recommendations: []
    };

    const headerStr = headers.join(' ').toLowerCase();

    // Check for basic company info
    if (headerStr.includes('company') && headerStr.includes('contact')) {
      analysis.hasBasicInfo = true;
    } else {
      analysis.recommendations.push('Add basic company and contact information fields');
    }

    // Check for stage tracking
    if (headerStr.includes('stage') || headerStr.includes('status') || headerStr.includes('phase')) {
      analysis.hasStageTracking = true;
    } else {
      analysis.recommendations.push('Add enterprise sales stage tracking');
    }

    // Check for value/deal tracking
    if (headerStr.includes('value') || headerStr.includes('deal') || headerStr.includes('revenue')) {
      analysis.hasValueTracking = true;
    } else {
      analysis.recommendations.push('Add deal value and revenue potential tracking');
    }

    // Check for contact management
    if (headerStr.includes('email') && headerStr.includes('phone')) {
      analysis.hasContactInfo = true;
    } else {
      analysis.recommendations.push('Add comprehensive contact information fields');
    }

    // Check for activity tracking
    if (headerStr.includes('last') && (headerStr.includes('contact') || headerStr.includes('activity'))) {
      analysis.hasActivityTracking = true;
    } else {
      analysis.recommendations.push('Add last contact and next action tracking');
    }

    // Check for nurturing
    if (headerStr.includes('nurture') || headerStr.includes('sequence') || headerStr.includes('campaign')) {
      analysis.hasNurturing = true;
    } else {
      analysis.recommendations.push('Add automated nurturing and campaign tracking');
    }

    return analysis;
  }

  async generateEnterpriseStructure() {
    console.log('🏗️ Generating optimal Enterprise Pipeline structure...');

    const enterpriseStructure = {
      // Core Company Information
      companyInfo: [
        'Company Name',
        'Website', 
        'Industry',
        'Company Size',
        'Annual Revenue',
        'Headquarters',
        'Founded Year'
      ],

      // Contact Management
      contactInfo: [
        'Primary Contact',
        'Title/Role',
        'Email',
        'Phone',
        'LinkedIn Profile',
        'Decision Maker Level',
        'Influence Score'
      ],

      // Enterprise Sales Pipeline
      salesPipeline: [
        'Lead Source',
        'Current Stage',
        'Probability %',
        'Deal Value ($)',
        'Expected Close Date',
        'Sales Cycle Length',
        'Competitive Situation'
      ],

      // Engagement Tracking
      engagement: [
        'First Contact Date',
        'Last Contact Date', 
        'Total Touchpoints',
        'Response Rate',
        'Engagement Score',
        'Next Action',
        'Next Action Date'
      ],

      // Enterprise Specific
      enterpriseSpecific: [
        'Security Requirements',
        'Compliance Needs',
        'Budget Authority',
        'Procurement Process',
        'Contract Value Range',
        'Implementation Timeline',
        'Technical Requirements'
      ],

      // Nurturing & Content
      nurturing: [
        'Nurture Sequence',
        'Content Delivered',
        'Whitepaper Downloads',
        'Demo Requested',
        'Proposal Status',
        'Objections/Concerns',
        'Success Criteria'
      ],

      // Analytics & Reporting
      analytics: [
        'Lead Score',
        'Fit Score',
        'Intent Score',
        'Activity Score',
        'Time in Stage',
        'Conversion Probability',
        'ROI Potential'
      ]
    };

    return enterpriseStructure;
  }

  async createEnterpriseStages() {
    return {
      stages: [
        {
          name: 'Target Identification',
          description: 'Research and identify high-value enterprise prospects',
          duration: '1-2 weeks',
          activities: ['Company research', 'Stakeholder mapping', 'Pain point analysis'],
          exitCriteria: 'Company fits ICP and shows business need'
        },
        {
          name: 'Initial Engagement',
          description: 'First contact and relationship building',
          duration: '2-4 weeks', 
          activities: ['Executive outreach', 'Value proposition delivery', 'Initial meetings'],
          exitCriteria: 'Stakeholder interest and meeting scheduled'
        },
        {
          name: 'Discovery & Qualification',
          description: 'Deep dive into needs, budget, and decision process',
          duration: '3-6 weeks',
          activities: ['Needs assessment', 'Technical requirements', 'Budget qualification'],
          exitCriteria: 'Clear understanding of needs and buying process'
        },
        {
          name: 'Solution Development',
          description: 'Customize solution and build business case',
          duration: '4-8 weeks',
          activities: ['Custom demo', 'ROI analysis', 'Technical documentation'],
          exitCriteria: 'Solution aligned with requirements and business case built'
        },
        {
          name: 'Proposal & Negotiation',
          description: 'Formal proposal and contract negotiation',
          duration: '4-12 weeks',
          activities: ['Proposal development', 'Contract terms', 'Stakeholder alignment'],
          exitCriteria: 'Agreement on terms and pricing'
        },
        {
          name: 'Contract & Implementation',
          description: 'Contract signing and solution implementation',
          duration: '2-8 weeks',
          activities: ['Contract execution', 'Implementation planning', 'Onboarding'],
          exitCriteria: 'Signed contract and successful implementation'
        },
        {
          name: 'Customer Success',
          description: 'Ongoing relationship and expansion opportunities',
          duration: 'Ongoing',
          activities: ['Regular check-ins', 'Success metrics', 'Expansion opportunities'],
          exitCriteria: 'Customer satisfaction and expansion potential'
        }
      ]
    };
  }

  async generateReport() {
    const analysis = await this.analyzeEnterprisePipeline();
    const structure = await this.generateEnterpriseStructure();
    const stages = await this.createEnterpriseStages();

    const report = {
      timestamp: new Date().toISOString(),
      currentState: analysis,
      recommendedStructure: structure,
      salesStages: stages,
      
      implementationPlan: {
        phase1: {
          title: 'Pipeline Structure Enhancement',
          duration: '1 week',
          tasks: [
            'Update Enterprise Pipeline headers with comprehensive fields',
            'Add sales stage tracking system',
            'Implement deal value and probability tracking',
            'Create automated stage progression workflows'
          ]
        },
        phase2: {
          title: 'Content & Nurturing System',
          duration: '2 weeks', 
          tasks: [
            'Build enterprise-specific content library',
            'Create automated nurture sequences',
            'Implement lead scoring system',
            'Set up personalized outreach templates'
          ]
        },
        phase3: {
          title: 'Analytics & Optimization',
          duration: '1 week',
          tasks: [
            'Build enterprise pipeline analytics',
            'Create conversion tracking',
            'Implement predictive lead scoring',
            'Set up automated reporting'
          ]
        }
      },

      quickWins: [
        'Move qualified enterprise leads from discovery to pipeline',
        'Set up basic stage progression tracking', 
        'Create enterprise-specific outreach templates',
        'Implement deal value estimation',
        'Build stakeholder mapping for key accounts'
      ],

      enterpriseLeadCriteria: {
        company: {
          minEmployees: 50,
          minRevenue: '$5M',
          industries: ['Construction', 'Real Estate', 'Property Management', 'Facilities'],
          locations: ['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide']
        },
        contact: {
          titles: ['CTO', 'CISO', 'VP', 'Director', 'Head of', 'General Manager'],
          decisionMakers: true,
          budgetAuthority: true
        },
        opportunity: {
          minDealValue: '$50000',
          contractLength: '12+ months',
          expansionPotential: true,
          strategicValue: 'High'
        }
      }
    };

    // Save comprehensive report
    fs.writeFileSync('enterprise-pipeline-analysis.json', JSON.stringify(report, null, 2));
    console.log('\n📋 Enterprise Pipeline Analysis saved to: enterprise-pipeline-analysis.json');

    return report;
  }

  async displayRecommendations(report) {
    console.log('\n🎯 ENTERPRISE PIPELINE RECOMMENDATIONS');
    console.log('====================================');

    if (report.currentState) {
      console.log('\n📊 CURRENT STATE ANALYSIS:');
      console.log(`✅ Basic Info: ${report.currentState.analysis.hasBasicInfo ? 'Present' : 'Missing'}`);
      console.log(`✅ Stage Tracking: ${report.currentState.analysis.hasStageTracking ? 'Present' : 'Missing'}`);
      console.log(`✅ Value Tracking: ${report.currentState.analysis.hasValueTracking ? 'Present' : 'Missing'}`);
      console.log(`✅ Contact Management: ${report.currentState.analysis.hasContactInfo ? 'Present' : 'Missing'}`);
    }

    console.log('\n🚀 QUICK WINS (Implement Now):');
    report.quickWins.forEach((win, index) => {
      console.log(`${index + 1}. ${win}`);
    });

    console.log('\n🏗️ IMPLEMENTATION PHASES:');
    Object.entries(report.implementationPlan).forEach(([phase, details]) => {
      console.log(`\n${phase.toUpperCase()}: ${details.title} (${details.duration})`);
      details.tasks.forEach(task => console.log(`  • ${task}`));
    });

    console.log('\n🎯 ENTERPRISE LEAD CRITERIA:');
    console.log(`Company Size: ${report.enterpriseLeadCriteria.company.minEmployees}+ employees`);
    console.log(`Revenue: ${report.enterpriseLeadCriteria.company.minRevenue}+ annual`);
    console.log(`Deal Value: ${report.enterpriseLeadCriteria.opportunity.minDealValue}+ minimum`);
    console.log(`Target Roles: ${report.enterpriseLeadCriteria.contact.titles.join(', ')}`);
  }
}

// Main execution
async function analyzeEnterprisePipeline() {
  console.log('🏢 ENTERPRISE PIPELINE ANALYSIS');
  console.log('===============================');

  const analyzer = new EnterprisePipelineAnalyzer();

  try {
    await analyzer.authenticate();
    const report = await analyzer.generateReport();
    await analyzer.displayRecommendations(report);

    console.log('\n✅ Analysis complete! Check enterprise-pipeline-analysis.json for full details.');
    return report;

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    throw error;
  }
}

// Export for use as module
module.exports = { EnterprisePipelineAnalyzer, analyzeEnterprisePipeline };

// Run if called directly
if (require.main === module) {
  analyzeEnterprisePipeline()
    .then(() => {
      console.log('\n🎉 Enterprise Pipeline analysis complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Analysis failed:', error.message);
      process.exit(1);
    });
}