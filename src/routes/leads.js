const express = require('express');
const { catchAsync } = require('../middleware/errorHandler');
const { query } = require('../config/database');

const router = express.Router();

// Get all leads
router.get('/', catchAsync(async (req, res) => {
  const { track, status, limit = 50 } = req.query;
  
  let whereClause = '';
  let params = [limit];
  
  if (track) {
    whereClause += ' WHERE l.track = $2';
    params.push(track);
  }
  
  if (status) {
    whereClause += (track ? ' AND' : ' WHERE') + ' l.status = $' + (params.length + 1);
    params.push(status);
  }

  const result = await query(`
    SELECT 
      l.id,
      l.track,
      l.status,
      l.stage,
      l.priority,
      c.name as company_name,
      CONCAT(contacts.first_name, ' ', contacts.last_name) as contact_name,
      l.created_at,
      l.updated_at
    FROM leads l
    JOIN companies c ON l.company_id = c.id
    JOIN contacts ON l.contact_id = contacts.id
    ${whereClause}
    ORDER BY l.updated_at DESC
    LIMIT $1
  `, params);

  res.json(result.rows);
}));

// Get single lead
router.get('/:id', catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await query(`
    SELECT 
      l.*,
      c.name as company_name,
      c.website,
      c.industry,
      c.employee_count,
      CONCAT(contacts.first_name, ' ', contacts.last_name) as contact_name,
      contacts.email,
      contacts.phone,
      contacts.title
    FROM leads l
    JOIN companies c ON l.company_id = c.id
    JOIN contacts ON l.contact_id = contacts.id
    WHERE l.id = $1
  `, [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  res.json(result.rows[0]);
}));

module.exports = router;