const express = require('express');
const { catchAsync } = require('../middleware/errorHandler');
const { query } = require('../config/database');

const router = express.Router();

// Get performance metrics
router.get('/metrics', catchAsync(async (req, res) => {
  const { timeRange = '30' } = req.query;
  
  const result = await query(`
    SELECT 
      track,
      COUNT(*) as total_leads,
      COUNT(CASE WHEN stage = 'meeting' THEN 1 END) as meetings,
      COUNT(CASE WHEN status = 'closed_won' THEN 1 END) as closed_deals,
      AVG(CASE WHEN status = 'closed_won' THEN 1.0 ELSE 0.0 END) as conversion_rate
    FROM leads 
    WHERE created_at >= CURRENT_DATE - INTERVAL '${timeRange} days'
    GROUP BY track
  `);

  res.json(result.rows);
}));

// Get conversion funnel
router.get('/funnel', catchAsync(async (req, res) => {
  const result = await query(`
    SELECT 
      l.stage,
      l.track,
      COUNT(*) as count
    FROM leads l
    WHERE l.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY l.stage, l.track
    ORDER BY l.track, 
      CASE l.stage 
        WHEN 'lead' THEN 1
        WHEN 'qualified' THEN 2
        WHEN 'meeting' THEN 3
        WHEN 'proposal' THEN 4
        WHEN 'closed_won' THEN 5
        ELSE 6
      END
  `);

  res.json(result.rows);
}));

module.exports = router;