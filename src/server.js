const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

const { logger } = require('./utils/logger');
const { connectDatabase, connectRedis } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// Import routes
const sheetsRoutes = require('./routes/sheets');
const agentsRoutes = require('./routes/agents');
const leadsRoutes = require('./routes/leads');
const analyticsRoutes = require('./routes/analytics');

// Import services
const AgentCoordinator = require('./agents/coordinator');
const SheetsService = require('./services/sheetsService');

class GallifreyRainmakerServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.agentCoordinator = null;
    this.sheetsService = null;
  }

  async initialize() {
    try {
      // Connect to databases
      await connectDatabase();
      await connectRedis();
      
      // Initialize services
      this.sheetsService = new SheetsService();
      await this.sheetsService.initialize();
      
      this.agentCoordinator = new AgentCoordinator();
      await this.agentCoordinator.initialize();

      // Configure middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();

      logger.info('Server initialization completed successfully');
    } catch (error) {
      logger.error('Server initialization failed:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://script.google.com', 'https://docs.google.com']
        : true,
      credentials: true
    }));

    // Rate limiting
    const rateLimiter = new RateLimiterMemory({
      points: parseInt(process.env.API_RATE_LIMIT_REQUESTS) || 100,
      duration: parseInt(process.env.API_RATE_LIMIT_WINDOW) / 1000 || 900, // Convert to seconds
    });
    
    this.app.use('/api/', async (req, res, next) => {
      try {
        await rateLimiter.consume(req.ip);
        next();
      } catch (rejRes) {
        res.status(429).json({ error: 'Too many requests from this IP' });
      }
    });

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        agents: this.agentCoordinator ? this.agentCoordinator.getHealthStatus() : 'not-initialized'
      });
    });

    // API routes
    this.app.use('/api/sheets', sheetsRoutes);
    this.app.use('/api/agents', authMiddleware, agentsRoutes);
    this.app.use('/api/leads', authMiddleware, leadsRoutes);
    this.app.use('/api/analytics', authMiddleware, analyticsRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Gallifrey Rainmaker API',
        documentation: '/api/docs',
        health: '/health'
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  async start() {
    try {
      await this.initialize();
      
      const server = this.app.listen(this.port, () => {
        logger.info(`Gallifrey Rainmaker server running on port ${this.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        logger.info(`Health check available at: http://localhost:${this.port}/health`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.gracefulShutdown(server));
      process.on('SIGINT', () => this.gracefulShutdown(server));

      return server;
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async gracefulShutdown(server) {
    logger.info('Received shutdown signal, starting graceful shutdown...');
    
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop agent coordinator
    if (this.agentCoordinator) {
      await this.agentCoordinator.shutdown();
    }

    // Additional cleanup can be added here
    
    process.exit(0);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new GallifreyRainmakerServer();
  server.start().catch(error => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}

module.exports = GallifreyRainmakerServer;