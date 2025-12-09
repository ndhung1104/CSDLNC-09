import knex from 'knex';

const db = knex({
    client: 'mssql',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '1433'),
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || 'PetCareX@2024',
        database: process.env.DB_NAME || 'PETCAREX',
        options: {
            encrypt: true,
            trustServerCertificate: true,
        },
    },
    pool: { min: 2, max: 10 },
});

db.raw('SELECT 1')
    .then(() => console.log('✅ Database connected'))
    .catch((err) => console.error('❌ Database error:', err.message));

export default db;
