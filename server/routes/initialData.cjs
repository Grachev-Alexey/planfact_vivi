const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');

router.get('/init', async (req, res) => {
  try {
    const transactionsQuery = `SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT 1000`;
    
    // Dynamic balance calculation
    const accountsQuery = `
      SELECT a.id, a.name, a.type, a.currency, a.initial_balance,
        (COALESCE(a.initial_balance, 0) + COALESCE((
            SELECT SUM(CASE 
                WHEN t.account_id = a.id AND t.type = 'income' THEN t.amount
                WHEN t.account_id = a.id AND t.type = 'expense' THEN -t.amount
                WHEN t.account_id = a.id AND t.type = 'transfer' THEN -t.amount
                WHEN t.to_account_id = a.id AND t.type = 'transfer' THEN t.amount
                ELSE 0 END)
            FROM transactions t
            WHERE t.account_id = a.id OR t.to_account_id = a.id
        ), 0)) as balance
      FROM accounts a WHERE a.is_archived = FALSE ORDER BY a.name
    `;

    const [txRes, accRes, catRes, stdRes, contrRes, projRes] = await Promise.all([
      db.query(transactionsQuery),
      db.query(accountsQuery),
      db.query('SELECT * FROM categories ORDER BY name'),
      db.query('SELECT * FROM studios ORDER BY name'),
      db.query('SELECT * FROM contractors ORDER BY name'),
      db.query('SELECT * FROM projects ORDER BY name')
    ]);

    res.json({
      transactions: txRes.rows.map(toCamelCase),
      accounts: accRes.rows.map(toCamelCase),
      categories: catRes.rows.map(toCamelCase),
      studios: stdRes.rows.map(toCamelCase),
      contractors: contrRes.rows.map(toCamelCase),
      projects: projRes.rows.map(toCamelCase)
    });

  } catch (err) {
    console.error('Error fetching init data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;