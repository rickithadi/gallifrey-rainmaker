const { logger, agentLogger } = require('../utils/logger');
const { query } = require('../config/database');

class BaseAgent {
  constructor(openai, config = {}) {
    this.openai = openai;
    this.contextSize = config.contextSize || 8000;
    this.instanceId = config.instanceId || 0;
    this.coordinator = config.coordinator;
    
    this.status = 'idle';
    this.currentTask = null;
    this.taskQueue = [];
    this.contextWindow = [];
    this.performance = {
      tasksCompleted: 0,
      tasksSuccessful: 0,
      avgResponseTime: 0,
      lastActivity: null
    };
    
    // Agent-specific configuration
    this.agentName = this.constructor.name;
    this.systemPrompt = this.getSystemPrompt();
    this.capabilities = this.getCapabilities();
  }

  async initialize() {
    agentLogger.info(`Initializing ${this.agentName}_${this.instanceId}`);
    this.status = 'idle';
    
    // Load any persistent context or configuration
    await this.loadContext();
  }

  // Override in subclasses
  getSystemPrompt() {
    return `You are a specialized AI agent for the Gallifrey marketing automation system.`;
  }

  // Override in subclasses  
  getCapabilities() {
    return ['general_analysis'];
  }

  // Process a lead - main entry point
  async processLead(leadId) {
    const startTime = Date.now();
    
    try {
      this.status = 'active';
      this.currentTask = `process_lead_${leadId}`;
      
      agentLogger.info(`${this.agentName}_${this.instanceId} starting lead processing`, { leadId });

      // Get lead data
      const leadData = await this.getLeadData(leadId);
      
      // Add to context window
      this.addToContext({
        type: 'lead_data',
        leadId,
        data: leadData,
        timestamp: new Date().toISOString()
      });

      // Perform agent-specific processing
      const result = await this.executeTask(leadData);
      
      // Log activity
      await this.logActivity(leadId, 'process_lead', result, 'success');
      
      // Update performance metrics
      this.updatePerformance(true, Date.now() - startTime);
      
      this.status = 'idle';
      this.currentTask = null;
      
      agentLogger.info(`${this.agentName}_${this.instanceId} completed lead processing`, { 
        leadId,
        duration: Date.now() - startTime,
        result: result.summary
      });

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      agentLogger.error(`${this.agentName}_${this.instanceId} failed to process lead`, {
        leadId,
        error: error.message,
        duration
      });

      await this.logActivity(leadId, 'process_lead', { error: error.message }, 'error');
      this.updatePerformance(false, duration);
      
      this.status = 'error';
      throw error;
    }
  }

  // Override in subclasses - main work method
  async executeTask(leadData) {
    throw new Error('executeTask must be implemented by subclass');
  }

  async getLeadData(leadId) {
    const result = await query(`
      SELECT 
        l.*,
        c.name as company_name,
        c.website,
        c.industry,
        c.employee_count,
        c.revenue_range,
        c.location,
        c.description as company_description,
        contacts.first_name,
        contacts.last_name,
        contacts.email,
        contacts.phone,
        contacts.title,
        contacts.linkedin_url,
        ed.annual_revenue,
        ed.security_requirements,
        ed.compliance_needs,
        ed.technical_stack,
        ed.decision_makers,
        smb.monthly_platform_cost,
        smb.platform_dependencies,
        smb.urgency_level,
        smb.local_market_presence
      FROM leads l
      JOIN companies c ON l.company_id = c.id
      JOIN contacts ON l.contact_id = contacts.id
      LEFT JOIN enterprise_data ed ON c.id = ed.company_id
      LEFT JOIN smb_data smb ON c.id = smb.company_id
      WHERE l.id = $1
    `, [leadId]);

    if (result.rows.length === 0) {
      throw new Error(`Lead ${leadId} not found`);
    }

    return result.rows[0];
  }

  // Context window management
  addToContext(contextItem) {
    this.contextWindow.push(contextItem);
    
    // Manage context size
    this.manageContextSize();
  }

  manageContextSize() {
    const contextText = JSON.stringify(this.contextWindow);
    const estimatedTokens = contextText.length / 4; // Rough token estimation
    
    if (estimatedTokens > this.contextSize * 0.8) {
      // Remove oldest items until we're under 80% of context size
      while (estimatedTokens > this.contextSize * 0.6 && this.contextWindow.length > 1) {
        this.contextWindow.shift();
      }
      
      agentLogger.info(`${this.agentName}_${this.instanceId} trimmed context window`, {
        itemsRemaining: this.contextWindow.length,
        estimatedTokens
      });
    }
  }

  // Build messages for OpenAI API
  buildMessages(prompt, includeContext = true) {
    const messages = [
      {
        role: 'system',
        content: this.systemPrompt
      }
    ];

    if (includeContext && this.contextWindow.length > 0) {
      const contextSummary = this.summarizeContext();
      messages.push({
        role: 'system', 
        content: `Previous context:\n${contextSummary}`
      });
    }

    messages.push({
      role: 'user',
      content: prompt
    });

    return messages;
  }

  summarizeContext() {
    return this.contextWindow
      .slice(-5) // Last 5 items
      .map(item => `${item.type}: ${JSON.stringify(item.data || item).substring(0, 200)}...`)
      .join('\n');
  }

  // Make OpenAI API call with error handling
  async callOpenAI(messages, options = {}) {
    const startTime = Date.now();
    
    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4-turbo-preview',
        messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 1000,
        ...options
      });

      const duration = Date.now() - startTime;
      
      agentLogger.info(`${this.agentName}_${this.instanceId} OpenAI call completed`, {
        model: options.model || 'gpt-4-turbo-preview',
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        duration
      });

      return response.choices[0].message.content.trim();
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      agentLogger.error(`${this.agentName}_${this.instanceId} OpenAI call failed`, {
        error: error.message,
        duration
      });
      
      throw error;
    }
  }

  // Log agent activity to database
  async logActivity(leadId, activityType, output, status) {
    try {
      // Get agent assignment ID
      const assignmentResult = await query(`
        SELECT id FROM agent_assignments 
        WHERE lead_id = $1 AND agent_name = $2 AND status = 'active'
        ORDER BY assigned_at DESC LIMIT 1
      `, [leadId, `${this.agentName.toLowerCase()}_${this.instanceId}`]);

      const assignmentId = assignmentResult.rows[0]?.id;

      await query(`
        INSERT INTO agent_activities (
          agent_assignment_id, lead_id, activity_type, description, 
          output_data, status, duration_ms, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [
        assignmentId,
        leadId,
        activityType,
        output.summary || 'Agent activity',
        JSON.stringify(output),
        status,
        output.duration || 0
      ]);
      
    } catch (error) {
      agentLogger.error(`Failed to log activity for ${this.agentName}_${this.instanceId}:`, error);
    }
  }

  // Update performance metrics
  updatePerformance(success, duration) {
    this.performance.tasksCompleted++;
    if (success) {
      this.performance.tasksSuccessful++;
    }
    
    // Update average response time
    this.performance.avgResponseTime = (
      (this.performance.avgResponseTime * (this.performance.tasksCompleted - 1)) + duration
    ) / this.performance.tasksCompleted;
    
    this.performance.lastActivity = new Date().toISOString();

    // Update coordinator metrics
    if (this.coordinator) {
      const successRate = this.performance.tasksSuccessful / this.performance.tasksCompleted;
      this.coordinator.updateAgentMetrics(`${this.agentName.toLowerCase()}_${this.instanceId}`, {
        tasksCompleted: this.performance.tasksCompleted,
        successRate: successRate,
        avgResponseTime: this.performance.avgResponseTime,
        status: this.status
      });
    }
  }

  // Agent control methods
  async pause() {
    this.status = 'paused';
    agentLogger.info(`${this.agentName}_${this.instanceId} paused`);
    return { status: 'paused' };
  }

  async resume() {
    this.status = 'idle';
    agentLogger.info(`${this.agentName}_${this.instanceId} resumed`);
    return { status: 'resumed' };
  }

  async reset() {
    this.status = 'idle';
    this.currentTask = null;
    this.taskQueue = [];
    this.contextWindow = [];
    
    agentLogger.info(`${this.agentName}_${this.instanceId} reset`);
    return { status: 'reset' };
  }

  // Load persistent context (override in subclasses if needed)
  async loadContext() {
    // Default implementation - no persistent context
  }

  // Get agent status for monitoring
  getStatus() {
    return {
      agentName: this.agentName,
      instanceId: this.instanceId,
      status: this.status,
      currentTask: this.currentTask,
      queueLength: this.taskQueue.length,
      performance: this.performance,
      capabilities: this.capabilities,
      contextItems: this.contextWindow.length
    };
  }
}

module.exports = BaseAgent;