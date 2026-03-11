const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');

router.get('/contractors/search', async (req, res) => {
  const { q } = req.query;
  
  try {
    let query = 'SELECT id, name, phone FROM contractors WHERE type = $1';
    const params = ['customer'];
    
    if (q && q.trim()) {
      const searchTerm = `%${q}%`;
      query += ` AND (name ILIKE $2 OR phone ILIKE $2)`;
      params.push(searchTerm);
    }
    
    query += ` ORDER BY name ASC LIMIT 20`;
    const result = await db.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error searching contractors:', err);
    res.status(500).json({ error: 'Error searching contractors' });
  }
});

module.exports = router;
