require('dotenv').config();
const { Pool, types } = require('pg');

types.setTypeParser(1082, val => val);

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:cd5d56a8@213.226.124.2:5432/planfact_vivi';

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
