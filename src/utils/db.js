const knex = require('knex');

// Initialize Knex with MS SQL Server configuration
const db = knex({
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'PetCareX@2024',
    database: process.env.DB_NAME || 'PETCAREX',
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || 'PetCareX@2024',
      },
    },
    requestTimeout: 30000,
    connectionTimeout: 30000,
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    min: 2,
    max: 10,
  },
});

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Database connected successfully');
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err.message);
  });

module.exports = db;
