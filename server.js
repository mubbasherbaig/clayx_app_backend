const app = require('./src/app');
const pool = require('./src/config/database');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const socketHandler = require('./src/websocket/socketHandler');

const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

let server;

// Test database connection before starting server
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  
  console.log('✅ Database connected at:', res.rows[0].now);
  
  // Create HTTP or HTTPS server
  if (USE_HTTPS && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
    const httpsOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    server = https.createServer(httpsOptions, app);
    console.log('🔒 HTTPS mode enabled');
  } else {
    server = http.createServer(app);
    console.log('🔓 HTTP mode (development)');
  }

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: "*", // Configure this properly for production
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  });

  // Setup WebSocket handlers
  socketHandler(io);

  // Make io accessible to routes if needed
  app.set('io', io);
  
  // Start server
  server.listen(PORT, () => {
    const protocol = USE_HTTPS ? 'https' : 'http';
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: ${protocol}://localhost:${PORT}`);
    console.log(`🔌 WebSocket URL: ${protocol}://localhost:${PORT}`);
    console.log(`🌱 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
    });
  });
});