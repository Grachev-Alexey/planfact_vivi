const { Pool, types } = require('pg');

types.setTypeParser(1082, val => val);

const connectionString = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: No database connection string found. Set EXTERNAL_DATABASE_URL secret.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('213.226.124.2') ? false : { rejectUnauthorized: false },
});

pool.on('connect', (client) => {
  client.query("SET timezone = 'Europe/Moscow'");
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
