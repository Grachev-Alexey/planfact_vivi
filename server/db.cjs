const { Pool, types } = require('pg');

types.setTypeParser(1082, val => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

pool.on('connect', (client) => {
  client.query("SET timezone = 'Europe/Moscow'");
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
