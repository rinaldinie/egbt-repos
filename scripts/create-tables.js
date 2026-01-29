/**
 * Script per creare le tabelle nel database PostgreSQL
 * Da eseguire prima di avviare l'applicazione
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const createTablesSQL = `
DROP TABLE IF EXISTS notified_games CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegramId INTEGER UNIQUE NOT NULL,
  username VARCHAR(255),
  firstName VARCHAR(255),
  chatId INTEGER UNIQUE NOT NULL,
  subscribed BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  isGroup BOOLEAN DEFAULT false
);

CREATE TABLE notified_games (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  notifiedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  endDate VARCHAR(255)
);
`;

async function createTables() {
    try {
        console.log('🔄 Creating database tables...');
        await pool.query(createTablesSQL);
        console.log('✅ Tables created successfully!');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
        await pool.end();
        process.exit(1);
    }
}

createTables();
