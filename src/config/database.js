const { Pool } = require('pg');
const redis = require('redis');
const { logger } = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.pgPool = null;
    this.redisClient = null;
  }

  async connectDatabase() {
    try {
      this.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pgPool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      logger.info('PostgreSQL connected successfully', { 
        time: result.rows[0].now 
      });

      // Setup connection error handling
      this.pgPool.on('error', (err) => {
        logger.error('PostgreSQL pool error:', err);
      });

    } catch (error) {
      logger.error('PostgreSQL connection failed:', error);
      throw error;
    }
  }

  async connectRedis() {
    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      await this.redisClient.connect();

      // Test connection
      await this.redisClient.ping();
      logger.info('Redis ping successful');

    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  getPool() {
    if (!this.pgPool) {
      throw new Error('Database not connected. Call connectDatabase() first.');
    }
    return this.pgPool;
  }

  getRedis() {
    if (!this.redisClient) {
      throw new Error('Redis not connected. Call connectRedis() first.');
    }
    return this.redisClient;
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pgPool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', { 
        query: text.substring(0, 100) + '...', 
        duration,
        rows: res.rowCount 
      });
      
      return res;
    } catch (error) {
      logger.error('Query error:', { 
        query: text.substring(0, 100) + '...', 
        error: error.message 
      });
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async closeConnections() {
    if (this.pgPool) {
      await this.pgPool.end();
      logger.info('PostgreSQL pool closed');
    }
    if (this.redisClient) {
      await this.redisClient.quit();
      logger.info('Redis connection closed');
    }
  }
}

// Global database manager instance
const dbManager = new DatabaseManager();

// Export convenience functions
module.exports = {
  connectDatabase: () => dbManager.connectDatabase(),
  connectRedis: () => dbManager.connectRedis(),
  query: (text, params) => dbManager.query(text, params),
  getPool: () => dbManager.getPool(),
  getRedis: () => dbManager.getRedis(),
  transaction: (callback) => dbManager.transaction(callback),
  closeConnections: () => dbManager.closeConnections()
};