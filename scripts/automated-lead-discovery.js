const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();

// Automated Lead Discovery System
class LeadDiscoveryEngine {
  constructor() {
    this.sources = {
      directories: [
        'https://www.yellowpages.com.au/search/listings?clue=construction+services&locationClue=melbourne',
        'https://www.trustedtradie.com.au/construction/melbourne',
        'https://www.australiantenders.com.au/contractors/',
        'https://www.commercialrealestate.com.au/construction/',
        'https://www.hotfrog.com.au/companies/construction/victoria/melbourne',
        'https://www.truelocal.com.au/business/construction/victoria/melbourne'
      ],
      
      associations: [
        'Master Builders Association Victoria',
        'Housing Industry Association',
        'Australian Construction Industry Forum',
        'Civil Contractors Federation'
      ],
      
      searchQueries: [
        '"construction services" Melbourne 11-50 employees',
        '"building contractors" Melbourne small business',
        '"commercial builders" Melbourne Victoria',
        '"residential builders" Melbourne boutique',
        '"renovation contractors" Melbourne',
        '"maintenance services" Melbourne construction'
      ],
      
      linkedInQueries: [
        'site:linkedin.com/company "construction" "Melbourne" employees:11-50',
        'site:linkedin.com/in "construction manager" "melbourne"',
        'site:linkedin.com/in "building services" "owner" "melbourne"',
        'site:linkedin.com/company "building" "melbourne" employees:10-50'
      ]
    };
  }

  // Generate Apollo.io search parameters
  generateApolloSearch(industry, location, companySize) {
    return {
      url: 'https://app.apollo.io/search/companies',
      filters: {
        industry_keywords: [industry, 'building', 'contractors', 'renovation'],
        locations: [location, 'Melbourne VIC', 'Victoria Australia'],
        employee_count: companySize,
        technologies: [], // Can add specific tech stack if needed
        company_type: ['Private Company'],
        revenue_range: ['$1M - $10M', '$10M - $50M'] // SMB range
      },
      exportInstructions: [
        '1. Login to Apollo.io',
        '2. Navigate to Company Search',
        '3. Apply filters: Industry = Construction, Location = Melbourne, Employees = 11-50',
        '4. Export first 100 results to CSV',
        '5. Download and import to Google Sheets'
      ]
    };
  }

  // Generate LinkedIn Sales Navigator search
  generateLinkedInSearch(targetIndustry, location) {
    return {
      url: 'https://www.linkedin.com/sales/search/company',
      filters: {
        companySize: ['11-50 employees', '51-200 employees'],
        location: [location],
        industry: [targetIndustry, 'Construction', 'Building Materials'],
        keywords: [
          'construction services',
          'building maintenance', 
          'commercial building',
          'residential building',
          'renovation services',
          'facility management'
        ]
      },
      searchProcess: [
        '1. Login to LinkedIn Sales Navigator',
        '2. Go to Company Search',
        '3. Set location to Melbourne, Australia',
        '4. Set company size to 11-50 employees',
        '5. Add industry filters for Construction',
        '6. Export up to 2,500 companies (premium limit)',
        '7. Download CSV and process contacts'
      ]
    };
  }

  // Generate comprehensive lead research report
  generateLeadReport(targetCompany, competitors = []) {
    const report = {
      timestamp: new Date().toISOString(),
      target: targetCompany,
      
      immediateActions: [
        'Search Apollo.io with provided filters',
        'Use LinkedIn Sales Navigator company search',
        'Check Yellow Pages and Trusted Tradie directories',
        'Research industry association member lists',
        'Monitor government tender databases for active contractors'
      ],
      
      automationOpportunities: [
        'Set up Google Alerts for "new construction companies Melbourne"',
        'Monitor company registration databases (ASIC)',
        'Track building permit applications in Melbourne councils',
        'Set up social media monitoring for construction hashtags',
        'Create automated email sequences for discovered leads'
      ],
      
      dataEnrichment: [
        'Use Hunter.io to find email addresses',
        'Clearbit for company intelligence and revenue estimates',
        'ZoomInfo for contact details and org charts',
        'Builtwith.com for technology stack analysis',
        'SimilarWeb for website traffic and engagement'
      ],
      
      qualificationCriteria: {
        idealProspects: [
          'Melbourne-based construction companies',
          '11-50 employees (SMB sweet spot)',
          'Annual revenue $1M-$10M',
          'Uses multiple software platforms (high platform fees)',
          'Active in commercial or residential building',
          'Growth-oriented (hiring, expanding services)'
        ],
        
        disqualifiers: [
          'Companies with in-house IT teams',
          'Recently completed major tech overhauls',
          'Very price-sensitive businesses',
          'Companies in financial distress',
          'Highly specialized niche players'
        ]
      }
    };

    return report;
  }

  // Process and clean lead data
  async processLeadData(rawLeads) {
    const processedLeads = [];
    
    for (const lead of rawLeads) {
      // Basic data cleaning and enrichment
      const cleanedLead = {
        companyName: this.cleanCompanyName(lead.company || lead.Company || ''),
        website: this.cleanWebsite(lead.website || lead.Website || ''),
        industry: lead.industry || 'construction',
        location: lead.location || 'Melbourne',
        employeeCount: this.parseEmployeeCount(lead.employees || lead.employeeCount || ''),
        source: lead.source || 'automated_discovery',
        confidence: this.calculateConfidence(lead),
        tags: this.generateTags(lead)
      };

      if (cleanedLead.companyName && cleanedLead.companyName.length > 2) {
        processedLeads.push(cleanedLead);
      }
    }

    return processedLeads;
  }

  cleanCompanyName(name) {
    return name
      .replace(/\b(pty ltd|pty|ltd|limited|inc|corp|corporation)\b/gi, '')
      .replace(/[^\w\s&-]/g, '')
      .trim();
  }

  cleanWebsite(website) {
    if (!website) return '';
    
    if (!website.startsWith('http')) {
      website = 'https://' + website;
    }
    
    return website.toLowerCase();
  }

  parseEmployeeCount(employees) {
    if (typeof employees === 'number') return employees;
    
    const str = employees.toString().toLowerCase();
    if (str.includes('11-50') || str.includes('11 to 50')) return '11-50';
    if (str.includes('10-50')) return '10-50';
    if (str.includes('51-200')) return '51-200';
    
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1]) : '';
  }

  calculateConfidence(lead) {
    let confidence = 0.5; // Base confidence
    
    if (lead.website && lead.website.includes('.com.au')) confidence += 0.2;
    if (lead.location && lead.location.toLowerCase().includes('melbourne')) confidence += 0.2;
    if (lead.industry && lead.industry.toLowerCase().includes('construction')) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  generateTags(lead) {
    const tags = [];
    
    if (lead.companyName) {
      const name = lead.companyName.toLowerCase();
      if (name.includes('build')) tags.push('builder');
      if (name.includes('construct')) tags.push('construction');
      if (name.includes('home')) tags.push('residential');
      if (name.includes('commercial')) tags.push('commercial');
      if (name.includes('renovation') || name.includes('reno')) tags.push('renovation');
    }
    
    return tags;
  }

  // Export leads to CSV format compatible with Google Sheets
  async exportToCSV(leads, filename) {
    const csvWriter = createCsvWriter({
      path: filename,
      header: [
        {id: 'companyName', title: 'Company Name'},
        {id: 'contactName', title: 'Contact Name'},
        {id: 'email', title: 'Email'},
        {id: 'phone', title: 'Phone'},
        {id: 'website', title: 'Website'},
        {id: 'industry', title: 'Industry'},
        {id: 'employeeCount', title: 'Company Size'},
        {id: 'location', title: 'Location'},
        {id: 'source', title: 'Source'},
        {id: 'notes', title: 'Notes'}
      ]
    });

    const csvData = leads.map(lead => ({
      companyName: lead.companyName,
      contactName: '', // To be filled manually or through contact discovery
      email: '', // To be found through Hunter.io or manual research
      phone: '', // To be found through directory lookup
      website: lead.website,
      industry: lead.industry,
      employeeCount: lead.employeeCount,
      location: lead.location,
      source: lead.source,
      notes: `Confidence: ${lead.confidence}, Tags: ${lead.tags?.join(', ')}`
    }));

    await csvWriter.writeRecords(csvData);
    console.log(`📄 Exported ${leads.length} leads to ${filename}`);
  }
}

// Main execution function
async function discoverMelbourneConstructionLeads() {
  console.log('🎯 AUTOMATED LEAD DISCOVERY SYSTEM');
  console.log('================================');
  
  const engine = new LeadDiscoveryEngine();
  
  // Target company profile (similar to Strata Multi Services)
  const targetProfile = {
    name: 'Melbourne Construction Companies',
    industry: 'construction',
    location: 'Melbourne, Australia',
    employeeRange: '11-50',
    revenueRange: '$1M-$10M',
    services: ['building services', 'construction', 'maintenance', 'renovation']
  };

  // Generate Apollo.io search parameters
  console.log('🚀 Generating Apollo.io search parameters...');
  const apolloSearch = engine.generateApolloSearch(
    targetProfile.industry, 
    targetProfile.location,
    targetProfile.employeeRange
  );

  // Generate LinkedIn search parameters
  console.log('💼 Generating LinkedIn Sales Navigator search...');
  const linkedInSearch = engine.generateLinkedInSearch(
    targetProfile.industry,
    targetProfile.location
  );

  // Generate comprehensive report
  console.log('📊 Generating lead discovery report...');
  const report = engine.generateLeadReport(targetProfile);

  // Save all configurations and instructions
  const outputData = {
    timestamp: new Date().toISOString(),
    targetProfile,
    apolloSearch,
    linkedInSearch,
    report,
    
    nextSteps: [
      '1. Execute Apollo.io search with provided filters',
      '2. Run LinkedIn Sales Navigator company search',
      '3. Manually check industry directories for additional leads',
      '4. Use Hunter.io to find contact emails for discovered companies',
      '5. Import all leads to Google Sheets using CSV template',
      '6. Set up automated nurture sequences for qualified leads'
    ]
  };

  // Save configuration file
  fs.writeFileSync(
    'automated-lead-discovery-config.json', 
    JSON.stringify(outputData, null, 2)
  );

  console.log('✅ Lead discovery system configured');
  console.log('📁 Configuration saved to: automated-lead-discovery-config.json');
  
  // Load and process existing leads
  const existingLeads = [
    { company: 'BuildPro Services', website: 'buildpro.com.au', location: 'Melbourne', source: 'competitor_analysis', industry: 'construction', employees: '11-50' },
    { company: 'ConstructCo Melbourne', website: 'constructco.com.au', location: 'Melbourne', source: 'competitor_analysis', industry: 'construction', employees: '11-50' },
    { company: 'Premier Building Group', website: 'premierbuilding.com.au', location: 'Melbourne', source: 'competitor_analysis', industry: 'construction', employees: '11-50' },
    { company: 'Hansen Living', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'Granvue Homes', website: 'granvuehomes.com.au', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'MJS Construction Group', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'First Avenue Homes', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'Boutique Homes', website: 'boutiquehomes.com.au', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'Home Builders Melbourne', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'Windiate Architects', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'Carlisle Homes', website: 'carlislehomes.com.au', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' },
    { company: 'Infinity Constructions', website: 'infinityconstructions.com.au', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '11-50' },
    { company: 'Jointly Commercial', website: 'jointly.com.au', location: 'Melbourne', source: 'web_research', industry: 'construction', employees: '10-50' }
  ];

  const processedLeads = await engine.processLeadData(existingLeads);
  await engine.exportToCSV(processedLeads, 'processed-construction-leads.csv');

  console.log('\n🎯 IMMEDIATE ACTION PLAN:');
  console.log('1. Visit Apollo.io and apply the generated filters');
  console.log('2. Export 100-500 construction companies from Apollo');
  console.log('3. Use LinkedIn Sales Navigator with provided search criteria');
  console.log('4. Export LinkedIn results (up to 2,500 companies)'); 
  console.log('5. Combine all data and import to your Google Sheets');
  console.log('6. Use Hunter.io to find contact emails for top prospects');

  return outputData;
}

// Run the automated discovery
discoverMelbourneConstructionLeads()
  .then(result => {
    console.log('\n✨ Lead discovery automation complete!');
  })
  .catch(error => {
    console.error('❌ Discovery failed:', error);
  });