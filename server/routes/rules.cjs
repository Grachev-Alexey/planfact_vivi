const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');

function calculateCreditDate(txDate, delayDays, weekendRule) {
  const d = new Date(txDate);
  d.setDate(d.getDate() + delayDays);

  const dayOfWeek = d.getDay();

  switch (weekendRule) {
    case 'next_business_day':
      if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
      else if (dayOfWeek === 6) d.setDate(d.getDate() + 2);
      break;
    case 'saturday_ok':
      if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
      break;
    case 'previous_business_day':
      if (dayOfWeek === 0) d.setDate(d.getDate() - 2);
      else if (dayOfWeek === 6) d.setDate(d.getDate() - 1);
      break;
    case 'no_adjustment':
      break;
    default:
      if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
      else if (dayOfWeek === 6) d.setDate(d.getDate() + 2);
      break;
  }

  return d.toISOString().split('T')[0];
}

router.get('/credit-date-rules', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, a.name as account_name 
      FROM credit_date_rules r
      LEFT JOIN accounts a ON r.account_id = a.id
      ORDER BY a.name, r.id
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching credit date rules:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/credit-date-rules', async (req, res) => {
  try {
    const { accountId, delayDays, weekendRule, name } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId required' });
    const result = await db.query(
      `INSERT INTO credit_date_rules (account_id, delay_days, weekend_rule, name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [accountId, delayDays || 1, weekendRule || 'next_business_day', name || '']
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating credit date rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/credit-date-rules/:id', async (req, res) => {
  try {
    const { accountId, delayDays, weekendRule, name, enabled } = req.body;
    const result = await db.query(
      `UPDATE credit_date_rules SET account_id=$1, delay_days=$2, weekend_rule=$3, name=$4, enabled=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [accountId, delayDays, weekendRule, name || '', enabled !== false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating credit date rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/credit-date-rules/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM credit_date_rules WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting credit date rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/credit-date-rules/calculate', async (req, res) => {
  try {
    const { accountId, date } = req.body;
    if (!accountId || !date) return res.status(400).json({ error: 'accountId and date required' });

    const ruleRes = await db.query(
      'SELECT * FROM credit_date_rules WHERE account_id = $1 AND enabled = true LIMIT 1',
      [accountId]
    );
    if (ruleRes.rows.length === 0) {
      return res.json({ creditDate: null });
    }
    const rule = ruleRes.rows[0];
    const creditDate = calculateCreditDate(date, rule.delay_days, rule.weekend_rule);
    res.json({ creditDate });
  } catch (err) {
    console.error('Error calculating credit date:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/auto-transfer-rules', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, 
        fa.name as from_account_name,
        ta.name as to_account_name
      FROM auto_transfer_rules r
      LEFT JOIN accounts fa ON r.from_account_id = fa.id
      LEFT JOIN accounts ta ON r.to_account_id = ta.id
      ORDER BY r.id
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching auto transfer rules:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/auto-transfer-rules', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, schedule, skipWeekends, skipDays, amount, transferAll, description } = req.body;
    if (!fromAccountId || !toAccountId) return res.status(400).json({ error: 'fromAccountId and toAccountId required' });
    if (!transferAll && (!amount || parseFloat(amount) <= 0)) return res.status(400).json({ error: 'amount required when not transferring all' });

    const result = await db.query(
      `INSERT INTO auto_transfer_rules (from_account_id, to_account_id, schedule, skip_weekends, skip_days, amount, transfer_all, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [fromAccountId, toAccountId, schedule || 'daily', skipWeekends || false, JSON.stringify(skipDays || []), transferAll ? null : amount, transferAll || false, description || '']
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating auto transfer rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/auto-transfer-rules/:id', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, schedule, skipWeekends, skipDays, amount, transferAll, description, enabled } = req.body;
    const result = await db.query(
      `UPDATE auto_transfer_rules SET from_account_id=$1, to_account_id=$2, schedule=$3, skip_weekends=$4, skip_days=$5, amount=$6, transfer_all=$7, description=$8, enabled=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [fromAccountId, toAccountId, schedule, skipWeekends || false, JSON.stringify(skipDays || []), transferAll ? null : amount, transferAll || false, description || '', enabled !== false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating auto transfer rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/auto-transfer-rules/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM auto_transfer_rules WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting auto transfer rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/auto-transfer-rules/execute', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();
    const dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek];

    const rules = await db.query(
      `SELECT * FROM auto_transfer_rules WHERE enabled = true AND (last_run_date IS NULL OR last_run_date < $1)`,
      [today]
    );

    const executed = [];
    for (const rule of rules.rows) {
      if (rule.skip_weekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;

      const skipDays = typeof rule.skip_days === 'string' ? JSON.parse(rule.skip_days) : (rule.skip_days || []);
      if (skipDays.includes(dayName)) continue;

      let transferAmount;
      if (rule.transfer_all) {
        const balRes = await db.query(`
          SELECT COALESCE(a.initial_balance, 0) + COALESCE((
            SELECT SUM(CASE 
              WHEN t.account_id = a.id AND t.type = 'income' THEN t.amount
              WHEN t.account_id = a.id AND t.type = 'expense' THEN -t.amount
              WHEN t.account_id = a.id AND t.type = 'transfer' THEN -t.amount
              WHEN t.to_account_id = a.id AND t.type = 'transfer' THEN t.amount
              ELSE 0 END)
            FROM transactions t
            WHERE (t.account_id = a.id OR t.to_account_id = a.id)
              AND (t.confirmed = true OR (t.type = 'expense' AND t.status IN ('paid', 'verified')))
              AND COALESCE(t.credit_date, t.date) <= CURRENT_DATE
          ), 0) as balance
          FROM accounts a WHERE a.id = $1
        `, [rule.from_account_id]);
        transferAmount = parseFloat(balRes.rows[0]?.balance || 0);
        if (transferAmount <= 0) continue;
      } else {
        transferAmount = parseFloat(rule.amount);
      }

      await db.query(
        `INSERT INTO transactions (date, amount, type, account_id, to_account_id, description, confirmed, external_id)
         VALUES ($1, $2, 'transfer', $3, $4, $5, true, $6)`,
        [today, transferAmount, rule.from_account_id, rule.to_account_id, rule.description || 'Авто-перемещение', `atr-${rule.id}-${today}`]
      );

      await db.query('UPDATE auto_transfer_rules SET last_run_date = $1 WHERE id = $2', [today, rule.id]);
      executed.push({ ruleId: rule.id, amount: transferAmount });
    }

    res.json({ success: true, executed });
  } catch (err) {
    console.error('Error executing auto transfer rules:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
