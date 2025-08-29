import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { google } from 'googleapis';

const HUNTER_API_KEY = process.env.HUNTER_IO_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { company, website, sheetRow } = req.body;
    
    console.log('Finding contacts for:', company, website);
    
    if (!website) {
      return res.status(400).json({ error: 'Website required for contact discovery' });
    }
    
    const contacts = [];
    
    // Use Hunter.io to find email addresses
    if (HUNTER_API_KEY) {
      try {
        const hunterResponse = await axios.get(
          `https://api.hunter.io/v2/domain-search?domain=${website}&api_key=${HUNTER_API_KEY}`
        );
        
        if (hunterResponse.data.data && hunterResponse.data.data.emails) {
          const emails = hunterResponse.data.data.emails
            .filter((email: any) => email.confidence > 50)
            .slice(0, 3) // Top 3 most confident emails
            .map((email: any) => ({
              email: email.value,
              firstName: email.first_name,
              lastName: email.last_name,
              position: email.position,
              confidence: email.confidence,
              source: 'Hunter.io'
            }));
          
          contacts.push(...emails);
        }
      } catch (hunterError) {
        console.error('Hunter.io API failed:', hunterError);
      }
    }
    
    // Fallback: Generate common email patterns
    if (contacts.length === 0) {
      const domain = website.replace(/https?:\/\//g, '').replace('www.', '').split('/')[0];
      const companyName = company.toLowerCase().replace(/\s+/g, '');
      
      const commonEmails = [
        `info@${domain}`,
        `admin@${domain}`,
        `sales@${domain}`,
        `contact@${domain}`,
        `enquiries@${domain}`,
        `office@${domain}`
      ];
      
      contacts.push(...commonEmails.map(email => ({
        email,
        firstName: '',
        lastName: '',
        position: 'General Contact',
        confidence: 30,
        source: 'Pattern Generation'
      })));
    }
    
    // Update Google Sheet if row provided
    if (sheetRow && contacts.length > 0) {
      try {
        
        const auth = new google.auth.JWT(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          undefined,
          process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/spreadsheets']
        );
        
        await auth.authorize();
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Update contact name and email columns
        const bestContact = contacts[0];
        const contactName = bestContact.firstName && bestContact.lastName 
          ? `${bestContact.firstName} ${bestContact.lastName}`
          : bestContact.position;
        
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEETS_ID,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              {
                range: `B${sheetRow}`, // Contact Name column
                values: [[contactName]]
              },
              {
                range: `C${sheetRow}`, // Email column
                values: [[bestContact.email]]
              }
            ]
          }
        });
        
        console.log('Updated sheet with contact info for row:', sheetRow);
      } catch (sheetError) {
        console.error('Failed to update sheet with contacts:', sheetError);
      }
    }
    
    return res.status(200).json({
      success: true,
      contacts: contacts,
      company: company,
      contactsFound: contacts.length
    });
    
  } catch (error) {
    console.error('Contact discovery failed:', error);
    return res.status(500).json({ 
      error: 'Contact discovery failed',
      details: (error as Error).message 
    });
  }
}

