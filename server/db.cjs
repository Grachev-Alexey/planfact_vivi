const { Pool, types } = require('pg');

types.setTypeParser(1082, val => val);

const pool = new Pool({
  connectionString: 'postgresql://postgres:cd5d56a8@213.226.124.2:5432/planfact_vivi',
});

pool.on('connect', (client) => {
  client.query("SET timezone = 'Europe/Moscow'");
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
