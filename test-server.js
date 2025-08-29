const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    message: 'Gallifrey Rainmaker API - Test Server'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Gallifrey Rainmaker API - Test Server',
    endpoints: {
      health: '/health',
      documentation: 'See README.md and GETTING_STARTED.md'
    },
    status: 'Server running - Database not connected',
    nextSteps: [
      '1. Set up PostgreSQL database',
      '2. Configure Google Service Account',
      '3. Run database migrations',
      '4. Set up Google Sheets integration'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: ['/', '/health']
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 Gallifrey Rainmaker Test Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📖 API docs: http://localhost:${port}/`);
  console.log(`\n⚠️  This is a test server. To run the full system:`);
  console.log(`   1. Set up PostgreSQL database`);
  console.log(`   2. Configure Google Service Account credentials`);
  console.log(`   3. Run: npm run db:migrate`);
  console.log(`   4. Run: npm run dev`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down test server...');
  server.close(() => {
    console.log('✅ Test server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test server...');
  server.close(() => {
    console.log('✅ Test server closed');
    process.exit(0);
  });
});