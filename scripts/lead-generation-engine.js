const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-writer').createObjectCsvWriter;
const { GoogleSheetsExporter } = require('./export-to-sheets');
require('dotenv').config({ path: '.env.local' });

class LeadGenerationEngine {
  constructor() {
    this.browser = null;
    this.sheetsExporter = new GoogleSheetsExporter();
    this.discoveredLeads = [];
    this.sources = {
      yellowPages: 'https://www.yellowpages.com.au',
      trustedTradie: 'https://www.trustedtradie.com.au',
      googleMaps: 'https://maps.google.com',
      linkedin: 'https://www.linkedin.com',
      businessDirectories: [
        'https://www.hotfrog.com.au',
        'https://www.truelocal.com.au',
        'https://www.australianbusinessdirectory.com.au'
      ]
    };
  }

  async initBrowser() {
    console.log('🌐 Initializing browser for web scraping...');
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    return this.browser;
  }

  // 1. SITE TROLLING - Scrape specific sites for leads
  async trollYellowPages(industry = 'construction', location = 'melbourne') {
    console.log(`🔍 Trolling Yellow Pages for ${industry} in ${location}...`);
    
    const page = await this.browser.newPage();
    const searchUrl = `https://www.yellowpages.com.au/search/listings?clue=${industry}+services&locationClue=${location}&lat=&lon=&selectedViewMode=list`;
    
    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Wait for listings to load
      await page.waitForSelector('.listing-results', { timeout: 10000 });
      
      const businesses = await page.evaluate(() => {
        const listings = document.querySelectorAll('.listing-item');
        const results = [];
        
        listings.forEach((listing, index) => {
          if (index < 20) { // Limit to first 20 results
            const nameEl = listing.querySelector('.listing-name a');
            const phoneEl = listing.querySelector('.contact-phone');
            const addressEl = listing.querySelector('.listing-address');
            const websiteEl = listing.querySelector('.contact-url a');
            
            if (nameEl) {
              results.push({
                companyName: nameEl.textContent?.trim() || '',
                phone: phoneEl?.textContent?.trim().replace(/\s+/g, ' ') || '',
                address: addressEl?.textContent?.trim().replace(/\s+/g, ' ') || '',
                website: websiteEl?.href || '',
                source: 'Yellow Pages',
                industry: 'construction',
                location: 'Melbourne'
              });
            }
          }
        });
        
        return results;
      });
      
      console.log(`📋 Found ${businesses.length} businesses from Yellow Pages`);
      this.discoveredLeads.push(...businesses);
      
    } catch (error) {
      console.error('❌ Yellow Pages scraping failed:', error.message);
    } finally {
      await page.close();
    }
    
    return this.discoveredLeads.filter(lead => lead.source === 'Yellow Pages');
  }

  async trollTrustedTradie(location = 'melbourne') {
    console.log(`🔧 Trolling Trusted Tradie for construction services in ${location}...`);
    
    const page = await this.browser.newPage();
    const searchUrl = `https://www.trustedtradie.com.au/construction/${location}`;
    
    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      // Wait for business listings
      await page.waitForSelector('.business-listing, .tradie-card', { timeout: 10000 });
      
      const businesses = await page.evaluate(() => {
        const listings = document.querySelectorAll('.business-listing, .tradie-card, .contractor-card');
        const results = [];
        
        listings.forEach((listing, index) => {
          if (index < 15) { // Limit results
            const nameEl = listing.querySelector('.business-name, .tradie-name, h3 a, h2 a');
            const phoneEl = listing.querySelector('.phone, .contact-phone');
            const locationEl = listing.querySelector('.location, .suburb, .address');
            const websiteEl = listing.querySelector('.website a, .visit-website');
            
            const name = nameEl?.textContent?.trim() || nameEl?.href?.split('/').pop()?.replace(/-/g, ' ') || '';
            
            if (name && name.length > 2) {
              results.push({
                companyName: name,
                phone: phoneEl?.textContent?.trim() || '',
                address: locationEl?.textContent?.trim() || '',
                website: websiteEl?.href || '',
                source: 'Trusted Tradie',
                industry: 'construction',
                location: 'Melbourne'
              });
            }
          }
        });
        
        return results;
      });
      
      console.log(`🔨 Found ${businesses.length} businesses from Trusted Tradie`);
      this.discoveredLeads.push(...businesses);
      
    } catch (error) {
      console.error('❌ Trusted Tradie scraping failed:', error.message);
    } finally {
      await page.close();
    }
    
    return this.discoveredLeads.filter(lead => lead.source === 'Trusted Tradie');
  }

  // 2. INTERNET TROLLING - Search across multiple directories
  async trollBusinessDirectories() {
    console.log('🌐 Trolling business directories for construction companies...');
    
    const searches = [
      { site: 'hotfrog.com.au', query: '/companies/construction/victoria/melbourne' },
      { site: 'truelocal.com.au', query: '/business/construction/vic/melbourne' },
      { site: 'australianbusinessdirectory.com.au', query: '/search?q=construction+melbourne' }
    ];
    
    for (const search of searches) {
      await this.scrapeDirectory(search.site, search.query);
      await this.delay(2000); // Be respectful with requests
    }
  }

  async scrapeDirectory(site, path) {
    console.log(`🕷️  Scraping ${site}...`);
    
    const page = await this.browser.newPage();
    const url = `https://${site}${path}`;
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const businesses = await page.evaluate((siteName) => {
        const results = [];
        
        // Generic selectors that work across different directory sites
        const selectors = [
          '.business-item',
          '.listing-item', 
          '.company-listing',
          '.business-card',
          '.search-result',
          '[data-business-name]',
          '.business-info'
        ];
        
        let listings = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            listings = elements;
            break;
          }
        }
        
        // If no structured listings, try to find business names in text
        if (listings.length === 0) {
          const textElements = document.querySelectorAll('h1, h2, h3, h4, .title, .name, strong');
          const businessPattern = /(construction|building|builder|contractor|renovation).*?(pty|ltd|services|group|company)/i;
          
          textElements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && businessPattern.test(text) && text.length < 100) {
              results.push({
                companyName: text,
                source: siteName,
                industry: 'construction',
                location: 'Melbourne'
              });
            }
          });
        } else {
          // Process structured listings
          listings.forEach((listing, index) => {
            if (index < 10) { // Limit results per site
              const nameSelectors = ['.name', '.business-name', '.title', 'h1', 'h2', 'h3', 'a[href*="business"]'];
              const phoneSelectors = ['.phone', '.contact', '[href^="tel:"]'];
              const websiteSelectors = ['.website', '[href^="http"]', '.url'];
              
              let name = '';
              for (const sel of nameSelectors) {
                const el = listing.querySelector(sel);
                if (el?.textContent?.trim()) {
                  name = el.textContent.trim();
                  break;
                }
              }
              
              if (name && name.length > 2 && name.length < 100) {
                let phone = '';
                for (const sel of phoneSelectors) {
                  const el = listing.querySelector(sel);
                  if (el) {
                    phone = el.textContent?.trim() || el.href?.replace('tel:', '') || '';
                    if (phone) break;
                  }
                }
                
                let website = '';
                for (const sel of websiteSelectors) {
                  const el = listing.querySelector(sel);
                  if (el?.href && el.href.startsWith('http')) {
                    website = el.href;
                    break;
                  }
                }
                
                results.push({
                  companyName: name,
                  phone: phone,
                  website: website,
                  source: siteName,
                  industry: 'construction',
                  location: 'Melbourne'
                });
              }
            }
          });
        }
        
        return results;
      }, site);
      
      console.log(`📊 Found ${businesses.length} businesses from ${site}`);
      this.discoveredLeads.push(...businesses);
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${site}:`, error.message);
    } finally {
      await page.close();
    }
  }

  // 3. SIMILAR BUSINESS FINDER - Find businesses similar to Strata Multi Services
  async findSimilarBusinesses(targetBusiness = 'Strata Multi Services') {
    console.log(`🎯 Finding businesses similar to ${targetBusiness}...`);
    
    // Google search for similar businesses
    await this.googleSearchSimilar(targetBusiness);
    
    // Industry association searches  
    await this.searchIndustryAssociations();
    
    // Government contract databases
    await this.searchGovernmentContracts();
  }

  async googleSearchSimilar(targetBusiness) {
    console.log('🔍 Searching Google for similar businesses...');
    
    const searches = [
      `"similar to ${targetBusiness}" construction Melbourne`,
      `"like ${targetBusiness}" building services Melbourne`,
      `construction companies Melbourne "building maintenance"`,
      `"facility management" Melbourne construction services`,
      `building contractors Melbourne "commercial construction"`,
      `"strata services" Melbourne construction building`
    ];
    
    for (const query of searches) {
      await this.performGoogleSearch(query);
      await this.delay(3000); // Respectful delay
    }
  }

  async performGoogleSearch(query) {
    const page = await this.browser.newPage();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      
      const results = await page.evaluate(() => {
        const searchResults = document.querySelectorAll('div[data-header-feature] h3, .g h3');
        const businesses = [];
        
        searchResults.forEach((result, index) => {
          if (index < 10) { // Top 10 results only
            const text = result.textContent?.trim();
            const link = result.closest('a')?.href;
            
            // Check if it looks like a business (not articles, directories, etc.)
            const businessIndicators = /(pty|ltd|services|group|construction|building|contractor)/i;
            if (text && businessIndicators.test(text) && text.length < 80) {
              businesses.push({
                companyName: text.replace(/[^\w\s&-]/g, '').trim(),
                website: link || '',
                source: 'Google Search',
                industry: 'construction',
                location: 'Melbourne'
              });
            }
          }
        });
        
        return businesses;
      });
      
      this.discoveredLeads.push(...results);
      
    } catch (error) {
      console.error('❌ Google search failed:', error.message);
    } finally {
      await page.close();
    }
  }

  async searchIndustryAssociations() {
    console.log('🏛️ Searching industry associations for member lists...');
    
    const associations = [
      'https://www.mbav.com.au/find-a-builder',
      'https://hia.com.au/builder-directory',
      'https://www.masterbuilder.com.au/find-a-builder'
    ];
    
    for (const url of associations) {
      await this.scrapeAssociationMembers(url);
      await this.delay(2000);
    }
  }

  async scrapeAssociationMembers(url) {
    const page = await this.browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const members = await page.evaluate(() => {
        const memberElements = document.querySelectorAll('.member, .builder, .company, .business-listing');
        const results = [];
        
        memberElements.forEach((member, index) => {
          if (index < 15) { // Limit results
            const name = member.querySelector('.name, .business-name, .title, h3, h2')?.textContent?.trim();
            const phone = member.querySelector('.phone, .contact')?.textContent?.trim();
            const website = member.querySelector('a[href^="http"]')?.href;
            
            if (name && name.length > 2) {
              results.push({
                companyName: name,
                phone: phone || '',
                website: website || '',
                source: 'Industry Association',
                industry: 'construction',
                location: 'Melbourne'
              });
            }
          }
        });
        
        return results;
      });
      
      console.log(`📋 Found ${members.length} members from association`);
      this.discoveredLeads.push(...members);
      
    } catch (error) {
      console.error('❌ Association scraping failed:', error.message);
    } finally {
      await page.close();
    }
  }

  // 4. DATA PROCESSING AND EXCEL POPULATION
  async processAndDeduplicateLeads() {
    console.log('🧹 Processing and deduplicating leads...');
    
    // Remove duplicates based on company name
    const unique = new Map();
    this.discoveredLeads.forEach(lead => {
      const key = this.normalizeCompanyName(lead.companyName);
      if (!unique.has(key) || unique.get(key).website === '') {
        unique.set(key, {
          ...lead,
          companyName: this.cleanCompanyName(lead.companyName),
          phone: this.cleanPhone(lead.phone),
          website: this.cleanWebsite(lead.website),
          confidence: this.calculateLeadScore(lead)
        });
      }
    });
    
    this.discoveredLeads = Array.from(unique.values())
      .filter(lead => lead.companyName.length > 2)
      .sort((a, b) => b.confidence - a.confidence);
    
    console.log(`✨ Processed ${this.discoveredLeads.length} unique leads`);
    return this.discoveredLeads;
  }

  async populateGoogleSheets() {
    console.log('📊 Populating Google Sheets with discovered leads...');
    
    const csvFile = 'discovered-leads.csv';
    await this.exportToCSV(csvFile);
    
    try {
      const result = await this.sheetsExporter.exportLeadsFromCSV(csvFile, 'New Leads Discovery');
      await this.sheetsExporter.formatSheet('New Leads Discovery');
      
      console.log(`✅ Successfully exported ${result.leadsExported} leads to Google Sheets`);
      return result;
    } catch (error) {
      console.error('❌ Google Sheets export failed:', error.message);
      throw error;
    }
  }

  async exportToCSV(filename) {
    const csvWriter = csv({
      path: filename,
      header: [
        {id: 'companyName', title: 'Company Name'},
        {id: 'contactName', title: 'Contact Name'},
        {id: 'email', title: 'Email'},
        {id: 'phone', title: 'Phone'},
        {id: 'website', title: 'Website'},
        {id: 'industry', title: 'Industry'},
        {id: 'companySize', title: 'Company Size'},
        {id: 'location', title: 'Location'},
        {id: 'source', title: 'Source'},
        {id: 'notes', title: 'Notes'}
      ]
    });

    const csvData = this.discoveredLeads.map(lead => ({
      companyName: lead.companyName,
      contactName: '',
      email: '',
      phone: lead.phone || '',
      website: lead.website || '',
      industry: lead.industry || 'construction',
      companySize: '10-50',
      location: lead.location || 'Melbourne',
      source: lead.source,
      notes: `Confidence: ${lead.confidence}, Auto-discovered`
    }));

    await csvWriter.writeRecords(csvData);
    console.log(`💾 Exported ${csvData.length} leads to ${filename}`);
  }

  // Utility methods
  normalizeCompanyName(name) {
    return name.toLowerCase()
      .replace(/\b(pty|ltd|limited|inc|corp|services|group)\b/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  cleanCompanyName(name) {
    return name.replace(/[^\w\s&-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/[^\d\s+-()]/g, '').trim();
  }

  cleanWebsite(website) {
    if (!website || !website.startsWith('http')) return '';
    try {
      const url = new URL(website);
      return url.hostname.replace('www.', '');
    } catch {
      return website;
    }
  }

  calculateLeadScore(lead) {
    let score = 0.5;
    
    if (lead.website && lead.website.includes('.com.au')) score += 0.3;
    if (lead.phone && lead.phone.length > 5) score += 0.2;
    if (lead.companyName.toLowerCase().includes('construction')) score += 0.2;
    if (lead.location.toLowerCase().includes('melbourne')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution function
async function generateNewLeads() {
  console.log('🚀 AUTOMATED LEAD GENERATION ENGINE');
  console.log('===================================');
  
  const engine = new LeadGenerationEngine();
  
  try {
    await engine.initBrowser();
    
    // 1. Troll specific sites
    console.log('\n🕷️  PHASE 1: SITE TROLLING');
    await engine.trollYellowPages('construction', 'melbourne');
    await engine.trollTrustedTradie('melbourne');
    
    // 2. Troll the internet
    console.log('\n🌐 PHASE 2: INTERNET TROLLING');
    await engine.trollBusinessDirectories();
    
    // 3. Find similar businesses
    console.log('\n🎯 PHASE 3: SIMILAR BUSINESS DISCOVERY');
    await engine.findSimilarBusinesses('Strata Multi Services');
    
    // 4. Process and populate Excel
    console.log('\n📊 PHASE 4: DATA PROCESSING & EXPORT');
    await engine.processAndDeduplicateLeads();
    const result = await engine.populateGoogleSheets();
    
    console.log('\n✅ LEAD GENERATION COMPLETE!');
    console.log(`📈 Total leads discovered: ${engine.discoveredLeads.length}`);
    console.log(`📊 Leads exported to Google Sheets: ${result.leadsExported}`);
    console.log(`🔗 View your leads: ${result.sheetUrl}`);
    
    // Save summary report
    const report = {
      timestamp: new Date().toISOString(),
      totalLeadsFound: engine.discoveredLeads.length,
      sourceBreakdown: engine.discoveredLeads.reduce((acc, lead) => {
        acc[lead.source] = (acc[lead.source] || 0) + 1;
        return acc;
      }, {}),
      topLeads: engine.discoveredLeads.slice(0, 10),
      nextActions: [
        'Review leads in Google Sheets',
        'Use Hunter.io to find contact emails',
        'Research each company for decision makers',
        'Create personalized outreach campaigns',
        'Set up automated follow-up sequences'
      ]
    };
    
    fs.writeFileSync('lead-generation-report.json', JSON.stringify(report, null, 2));
    console.log('📋 Detailed report saved to: lead-generation-report.json');
    
    return report;
    
  } catch (error) {
    console.error('❌ Lead generation failed:', error.message);
    throw error;
  } finally {
    await engine.cleanup();
  }
}

// Export for use as module
module.exports = { LeadGenerationEngine, generateNewLeads };

// Run if called directly
if (require.main === module) {
  generateNewLeads()
    .then(report => {
      console.log('\n🎉 Lead generation automation complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Generation failed:', error.message);
      process.exit(1);
    });
}