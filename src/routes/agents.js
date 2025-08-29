const express = require('express');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { query } = require('../config/database');
const { agentLogger } = require('../utils/logger');

const router = express.Router();

// Get agent status
router.get('/status', catchAsync(async (req, res) => {
  const result = await query(`
    SELECT 
      agent_type,
      agent_name,
      status,
      assigned_at,
      last_activity,
      performance_score,
      task_queue_length
    FROM agent_assignments
    WHERE status = 'active'
    ORDER BY agent_type, agent_name
  `);

  const agentStatus = result.rows.reduce((acc, row) => {
    if (!acc[row.agent_type]) {
      acc[row.agent_type] = [];
    }
    acc[row.agent_type].push({
      name: row.agent_name,
      status: row.status,
      lastActivity: row.last_activity,
      performance: row.performance_score,
      queueLength: row.task_queue_length
    });
    return acc;
  }, {});

  res.json(agentStatus);
}));

// Trigger agent action
router.post('/trigger', catchAsync(async (req, res) => {
  const { agentType, action, leadId, params = {} } = req.body;

  if (!agentType || !action) {
    throw new AppError('Agent type and action are required', 400);
  }

  // Log the trigger
  agentLogger.info('Manual agent trigger', {
    agentType,
    action,
    leadId,
    params,
    triggeredBy: req.user?.email || 'system'
  });

  // In a real implementation, this would trigger the actual agent
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  res.json({
    success: true,
    taskId,
    message: `${agentType} agent triggered for ${action}`
  });
}));

// Get agent activity logs
router.get('/logs', catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const agentType = req.query.agentType;

  let whereClause = '';
  let params = [limit];

  if (agentType) {
    whereClause = 'WHERE aa.agent_type = $2';
    params.push(agentType);
  }

  const result = await query(`
    SELECT 
      aa.created_at,
      aa.agent_name,
      aa.activity_type,
      aa.description,
      aa.status,
      aa.duration_ms,
      c.name as company_name
    FROM agent_activities aa
    LEFT JOIN leads l ON aa.lead_id = l.id
    LEFT JOIN companies c ON l.company_id = c.id
    JOIN agent_assignments ag ON aa.agent_assignment_id = ag.id
    ${whereClause}
    ORDER BY aa.created_at DESC
    LIMIT $1
  `, params);

  res.json(result.rows);
}));

module.exports = router;