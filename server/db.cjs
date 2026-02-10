const { Pool } = require('pg');

// Explicitly use the connection string from the user's .env file
const pool = new Pool({
  connectionString: 'postgresql://postgres:cd5d56a8@213.226.124.2:5432/planfact_vivi',
  // SSL is typically not required for direct IP connections unless configured on server.
  // If connection fails, try uncommenting the next line:
  // ssl: { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
