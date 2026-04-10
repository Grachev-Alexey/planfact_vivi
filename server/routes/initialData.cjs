const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');

router.get('/init', async (req, res) => {
  try {
    const transactionsQuery = `
      SELECT t.*, pr.status as pr_status, sa.name as settlement_account_name
      FROM transactions t
      LEFT JOIN payment_requests pr ON t.external_id = 'pr-' || pr.id::text
      LEFT JOIN accounts sa ON t.settlement_account_id = sa.id
      WHERE NOT (
        t.type = 'transfer'
        AND EXISTS (
          SELECT 1 FROM settlement_rules sr
          WHERE sr.enabled = true
            AND sr.account_id = t.account_id
            AND sr.settlement_account_id = t.to_account_id
        )
      )
      ORDER BY t.date DESC, t.created_at DESC LIMIT 1000
    `;
    
    // Dynamic balance calculation
    const accountsQuery = `
      SELECT a.id, a.name, a.type, a.currency, a.initial_balance, a.legal_entity_id,
        (COALESCE(a.initial_balance, 0) + COALESCE((
            SELECT SUM(CASE 
                WHEN t.account_id = a.id AND t.type = 'income' THEN t.amount
                WHEN t.account_id = a.id AND t.type = 'expense' THEN -t.amount
                WHEN t.account_id = a.id AND t.type = 'transfer'
                  AND NOT EXISTS (SELECT 1 FROM settlement_rules sr WHERE sr.enabled = true AND sr.account_id = t.account_id AND sr.settlement_account_id = t.to_account_id)
                  THEN -t.amount
                WHEN t.to_account_id = a.id AND t.type = 'transfer'
                  AND NOT EXISTS (SELECT 1 FROM settlement_rules sr WHERE sr.enabled = true AND sr.account_id = t.account_id AND sr.settlement_account_id = t.to_account_id)
                  THEN t.amount
                ELSE 0 END)
            FROM transactions t
            WHERE (t.account_id = a.id OR t.to_account_id = a.id)
              AND (t.confirmed = true OR (t.type = 'expense' AND t.status IN ('paid', 'verified')))
              AND COALESCE(t.credit_date, t.date) <= CURRENT_DATE
        ), 0)) as balance
      FROM accounts a WHERE a.is_archived = FALSE ORDER BY a.name
    `;

    const [txRes, accRes, catRes, stdRes, contrRes, leRes] = await Promise.all([
      db.query(transactionsQuery),
      db.query(accountsQuery),
      db.query('SELECT * FROM categories ORDER BY name'),
      db.query('SELECT * FROM studios ORDER BY name'),
      db.query('SELECT id, name, inn, phone, type, description, created_at, updated_at FROM contractors ORDER BY name'),
      db.query('SELECT * FROM legal_entities ORDER BY name')
    ]);

    res.json({
      transactions: txRes.rows.map(toCamelCase),
      accounts: accRes.rows.map(toCamelCase),
      categories: catRes.rows.map(toCamelCase),
      studios: stdRes.rows.map(toCamelCase),
      contractors: contrRes.rows.map(toCamelCase),
      legalEntities: leRes.rows.map(toCamelCase)
    });

  } catch (err) {
    console.error('Error fetching init data:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;