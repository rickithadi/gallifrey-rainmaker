const OpenAI = require('openai');
const { logger, agentLogger } = require('../utils/logger');
const { query, getRedis } = require('../config/database');
const { EventEmitter } = require('events');

// Import specialized agents
const EnterpriseResearchAgent = require('./enterprise/researchAgent');
const EnterpriseContentAgent = require('./enterprise/contentAgent');
const EnterpriseRelationshipAgent = require('./enterprise/relationshipAgent');
const SMBPlatformAgent = require('./smb/platformAgent');
const SMBLocalAgent = require('./smb/localAgent');
const SMBConversionAgent = require('./smb/conversionAgent');

class AgentCoordinator extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.redis = null;
    this.agents = new Map();
    this.activeJobs = new Map();
    this.maxConcurrentAgents = parseInt(process.env.MAX_CONCURRENT_AGENTS) || 6;
    
    // Agent performance tracking
    this.agentMetrics = new Map();
    
    // Classification configuration
    this.classificationThreshold = parseFloat(process.env.LEAD_CLASSIFICATION_THRESHOLD) || 0.80;
  }

  async initialize() {
    try {
      this.redis = getRedis();
      
      // Initialize all agent types
      await this.initializeAgents();
      
      // Start monitoring loop
      this.startMonitoring();
      
      agentLogger.info('Agent Coordinator initialized successfully', {
        agentCount: this.agents.size,
        maxConcurrent: this.maxConcurrentAgents
      });
      
    } catch (error) {
      agentLogger.error('Failed to initialize Agent Coordinator:', error);
      throw error;
    }
  }

  async initializeAgents() {
    const agentConfigs = [
      // Enterprise Track Agents
      {
        type: 'enterprise_research',
        class: EnterpriseResearchAgent,
        contextSize: parseInt(process.env.ENTERPRISE_RESEARCH_AGENT_CONTEXT_SIZE) || 16000,
        maxInstances: 2
      },
      {
        type: 'enterprise_content',
        class: EnterpriseContentAgent,
        contextSize: parseInt(process.env.ENTERPRISE_CONTENT_AGENT_CONTEXT_SIZE) || 16000,
        maxInstances: 2
      },
      {
        type: 'enterprise_relationship',
        class: EnterpriseRelationshipAgent,
        contextSize: parseInt(process.env.ENTERPRISE_RELATIONSHIP_AGENT_CONTEXT_SIZE) || 16000,
        maxInstances: 2
      },
      
      // SMB Track Agents
      {
        type: 'smb_platform',
        class: SMBPlatformAgent,
        contextSize: parseInt(process.env.SMB_PLATFORM_AGENT_CONTEXT_SIZE) || 8000,
        maxInstances: 3
      },
      {
        type: 'smb_local',
        class: SMBLocalAgent,
        contextSize: parseInt(process.env.SMB_LOCAL_AGENT_CONTEXT_SIZE) || 8000,
        maxInstances: 3
      },
      {
        type: 'smb_conversion',
        class: SMBConversionAgent,
        contextSize: parseInt(process.env.SMB_CONVERSION_AGENT_CONTEXT_SIZE) || 8000,
        maxInstances: 3
      }
    ];

    for (const config of agentConfigs) {
      const instances = [];
      
      for (let i = 0; i < config.maxInstances; i++) {
        const agent = new config.class(this.openai, {
          contextSize: config.contextSize,
          instanceId: i,
          coordinator: this
        });
        
        await agent.initialize();
        instances.push(agent);
        
        // Initialize metrics tracking
        this.agentMetrics.set(`${config.type}_${i}`, {
          tasksCompleted: 0,
          successRate: 0,
          avgResponseTime: 0,
          lastActivity: null,
          status: 'idle'
        });
      }
      
      this.agents.set(config.type, instances);
    }
  }

  // Lead classification using Master Coordinator
  async classifyLead(leadId) {
    const startTime = Date.now();
    
    try {
      // Get lead data
      const leadResult = await query(`
        SELECT 
          l.*,
          c.name as company_name,
          c.website,
          c.industry,
          c.employee_count,
          c.revenue_range,
          contacts.first_name,
          contacts.last_name,
          contacts.email,
          contacts.title
        FROM leads l
        JOIN companies c ON l.company_id = c.id
        JOIN contacts ON l.contact_id = contacts.id
        WHERE l.id = $1
      `, [leadId]);

      if (leadResult.rows.length === 0) {
        throw new Error(`Lead ${leadId} not found`);
      }

      const lead = leadResult.rows[0];
      
      // Build classification prompt
      const classificationPrompt = this.buildClassificationPrompt(lead);
      
      // Call OpenAI for classification
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are the Master Coordinator for Gallifrey's dual-track marketing system. 
                     Your job is to classify leads as either 'enterprise' or 'smb' track based on the provided data.
                     
                     ENTERPRISE TRACK criteria:
                     - Companies with 50+ employees
                     - Annual revenue > $5M
                     - Complex security/compliance requirements
                     - Long sales cycles acceptable
                     - High-value potential deals
                     
                     SMB TRACK criteria:
                     - Companies with < 50 employees
                     - Local Melbourne businesses
                     - Platform dependency issues
                     - Quick decision making needed
                     - Volume-based approach
                     
                     Respond with JSON: {"track": "enterprise|smb", "confidence": 0.0-1.0, "reasoning": "explanation", "priority": "high|medium|low"}`
          },
          {
            role: 'user',
            content: classificationPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      const classificationText = response.choices[0].message.content.trim();
      let classification;
      
      try {
        classification = JSON.parse(classificationText);
      } catch (parseError) {
        agentLogger.error('Failed to parse classification response:', parseError);
        // Fallback classification logic
        classification = this.fallbackClassification(lead);
      }

      // Update lead with classification
      await query(`
        UPDATE leads 
        SET track = $1, 
            priority = $2, 
            classification_confidence = $3,
            status = 'classified',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [classification.track, classification.priority, classification.confidence, leadId]);

      // Assign to appropriate track agents
      await this.assignToTrackAgents(leadId, classification.track);

      const duration = Date.now() - startTime;
      
      agentLogger.logAgentAction(
        'MasterCoordinator',
        'classify_lead',
        leadId,
        'SUCCESS',
        {
          track: classification.track,
          confidence: classification.confidence,
          priority: classification.priority,
          duration
        }
      );

      this.emit('leadClassified', {
        leadId,
        classification,
        duration
      });

      return classification;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      agentLogger.logAgentAction(
        'MasterCoordinator',
        'classify_lead',
        leadId,
        'ERROR',
        { error: error.message, duration }
      );
      
      throw error;
    }
  }

  buildClassificationPrompt(lead) {
    return `
Lead Information:
- Company: ${lead.company_name}
- Industry: ${lead.industry || 'Unknown'}
- Employees: ${lead.employee_count || 'Unknown'}
- Website: ${lead.website || 'None'}
- Contact: ${lead.first_name} ${lead.last_name}
- Title: ${lead.title || 'Unknown'}
- Email: ${lead.email}
- Notes: ${lead.notes || 'None'}

Please classify this lead and provide your reasoning.
    `.trim();
  }

  fallbackClassification(lead) {
    // Rule-based fallback classification
    let track = 'smb';
    let confidence = 0.60;
    let priority = 'medium';
    let reasoning = 'Fallback rule-based classification';

    if (lead.employee_count && lead.employee_count >= 50) {
      track = 'enterprise';
      confidence = 0.75;
    }

    if (lead.industry && ['technology', 'finance', 'healthcare'].includes(lead.industry.toLowerCase())) {
      track = 'enterprise';
      confidence = Math.min(confidence + 0.1, 0.85);
    }

    if (lead.title && ['cto', 'ciso', 'vp', 'director', 'head'].some(title => 
        lead.title.toLowerCase().includes(title))) {
      track = 'enterprise';
      confidence = Math.min(confidence + 0.1, 0.90);
      priority = 'high';
    }

    return { track, confidence, priority, reasoning };
  }

  async assignToTrackAgents(leadId, track) {
    try {
      if (track === 'enterprise') {
        // Assign to enterprise research agent first
        const researchAgent = this.getAvailableAgent('enterprise_research');
        if (researchAgent) {
          await this.createAgentAssignment(leadId, 'enterprise_research', researchAgent.instanceId);
          await researchAgent.processLead(leadId);
        }
      } else if (track === 'smb') {
        // Assign to SMB platform analysis agent first
        const platformAgent = this.getAvailableAgent('smb_platform');
        if (platformAgent) {
          await this.createAgentAssignment(leadId, 'smb_platform', platformAgent.instanceId);
          await platformAgent.processLead(leadId);
        }
      }
    } catch (error) {
      agentLogger.error('Failed to assign lead to track agents:', error);
      throw error;
    }
  }

  getAvailableAgent(agentType) {
    const agents = this.agents.get(agentType);
    if (!agents) return null;

    // Find least busy agent
    return agents.reduce((best, current) => {
      const bestMetrics = this.agentMetrics.get(`${agentType}_${best.instanceId}`);
      const currentMetrics = this.agentMetrics.get(`${agentType}_${current.instanceId}`);
      
      if (currentMetrics.status === 'idle' && bestMetrics.status !== 'idle') {
        return current;
      }
      
      if (currentMetrics.status === bestMetrics.status) {
        return currentMetrics.tasksCompleted < bestMetrics.tasksCompleted ? current : best;
      }
      
      return best;
    });
  }

  async createAgentAssignment(leadId, agentType, instanceId) {
    const agentName = `${agentType}_${instanceId}`;
    
    await query(`
      INSERT INTO agent_assignments (lead_id, agent_type, agent_name, assigned_at, status)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'active')
    `, [leadId, agentType, agentName]);

    // Update metrics
    const metrics = this.agentMetrics.get(agentName);
    if (metrics) {
      metrics.status = 'active';
      metrics.lastActivity = new Date();
    }
  }

  // Agent status monitoring
  startMonitoring() {
    setInterval(() => {
      this.monitorAgentHealth();
    }, 30000); // Every 30 seconds

    agentLogger.info('Agent monitoring started');
  }

  async monitorAgentHealth() {
    for (const [agentType, instances] of this.agents.entries()) {
      for (const agent of instances) {
        const agentName = `${agentType}_${agent.instanceId}`;
        const metrics = this.agentMetrics.get(agentName);
        
        if (metrics && metrics.lastActivity) {
          const timeSinceActivity = Date.now() - new Date(metrics.lastActivity).getTime();
          
          // If no activity for 10 minutes and status is active, mark as stale
          if (timeSinceActivity > 10 * 60 * 1000 && metrics.status === 'active') {
            metrics.status = 'stale';
            agentLogger.info(`Agent ${agentName} marked as stale`, { timeSinceActivity });
          }
        }
      }
    }
  }

  // Get health status for all agents
  getHealthStatus() {
    const status = {};
    
    for (const [agentType, instances] of this.agents.entries()) {
      status[agentType] = instances.map(agent => {
        const agentName = `${agentType}_${agent.instanceId}`;
        const metrics = this.agentMetrics.get(agentName);
        
        return {
          instanceId: agent.instanceId,
          status: metrics?.status || 'unknown',
          tasksCompleted: metrics?.tasksCompleted || 0,
          successRate: metrics?.successRate || 0,
          lastActivity: metrics?.lastActivity
        };
      });
    }
    
    return status;
  }

  // Manual agent controls
  async executeAgentCommand(agentType, command, params = {}) {
    const startTime = Date.now();
    
    try {
      const agent = this.getAvailableAgent(agentType);
      if (!agent) {
        throw new Error(`No available agent of type ${agentType}`);
      }

      let result;
      
      switch (command) {
        case 'pause':
          result = await agent.pause();
          break;
        case 'resume':
          result = await agent.resume();
          break;
        case 'reset':
          result = await agent.reset();
          break;
        case 'process_lead':
          if (!params.leadId) {
            throw new Error('leadId required for process_lead command');
          }
          result = await agent.processLead(params.leadId);
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }

      const duration = Date.now() - startTime;
      
      agentLogger.logAgentAction(
        `${agentType}_${agent.instanceId}`,
        command,
        params.leadId || 'system',
        'SUCCESS',
        { result, duration }
      );

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      agentLogger.logAgentAction(
        agentType,
        command,
        params.leadId || 'system',
        'ERROR',
        { error: error.message, duration }
      );
      
      throw error;
    }
  }

  // Update agent metrics
  updateAgentMetrics(agentName, update) {
    const metrics = this.agentMetrics.get(agentName);
    if (metrics) {
      Object.assign(metrics, update);
      metrics.lastActivity = new Date();
    }
  }

  // Graceful shutdown
  async shutdown() {
    agentLogger.info('Shutting down Agent Coordinator...');
    
    // Pause all agents
    for (const [agentType, instances] of this.agents.entries()) {
      for (const agent of instances) {
        try {
          await agent.pause();
        } catch (error) {
          agentLogger.error(`Error pausing agent ${agentType}_${agent.instanceId}:`, error);
        }
      }
    }
    
    // Clear active jobs
    this.activeJobs.clear();
    
    agentLogger.info('Agent Coordinator shutdown completed');
  }
}

module.exports = AgentCoordinator;