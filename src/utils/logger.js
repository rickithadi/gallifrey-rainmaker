const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'gallifrey-rainmaker' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Ensure logs directory exists
  const fs = require('fs');
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Error log file
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  // Combined log file
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));

  // Agent activity log
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'agents.log'),
    level: 'info',
    maxsize: 5242880, // 5MB
    maxFiles: 3,
    format: winston.format.combine(
      winston.format.label({ label: 'AGENTS' }),
      logFormat
    )
  }));
}

// Specialized loggers for different components
const agentLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.label({ label: 'AGENT' }),
    logFormat
  ),
  transports: logger.transports
});

const sheetsLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.label({ label: 'SHEETS' }),
    logFormat
  ),
  transports: logger.transports
});

const apiLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.label({ label: 'API' }),
    logFormat
  ),
  transports: logger.transports
});

// Helper functions for structured logging
const loggers = {
  // Main application logger
  logger,

  // Component-specific loggers
  agentLogger,
  sheetsLogger,
  apiLogger,

  // Helper methods
  logAgentAction: (agentName, action, target, result, metadata = {}) => {
    agentLogger.info(`Agent ${agentName} performed ${action}`, {
      agent: agentName,
      action,
      target,
      result,
      ...metadata
    });
  },

  logSheetsOperation: (operation, sheetName, rowsAffected, duration, error = null) => {
    const logData = {
      operation,
      sheetName,
      rowsAffected,
      duration,
      timestamp: new Date().toISOString()
    };

    if (error) {
      sheetsLogger.error(`Sheets operation failed: ${operation}`, { ...logData, error: error.message });
    } else {
      sheetsLogger.info(`Sheets operation completed: ${operation}`, logData);
    }
  },

  logApiRequest: (method, path, statusCode, duration, error = null) => {
    const logData = {
      method,
      path,
      statusCode,
      duration,
      timestamp: new Date().toISOString()
    };

    if (error) {
      apiLogger.error(`API request failed: ${method} ${path}`, { ...logData, error: error.message });
    } else {
      apiLogger.info(`API request completed: ${method} ${path}`, logData);
    }
  },

  // Performance monitoring
  logPerformanceMetric: (component, metric, value, unit = 'ms') => {
    logger.info(`Performance metric: ${component}.${metric}`, {
      component,
      metric,
      value,
      unit,
      timestamp: new Date().toISOString()
    });
  },

  // Error tracking with context
  logError: (error, context = {}) => {
    logger.error(error.message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = loggers;