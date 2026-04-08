const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function calculateCreditDate(txDate, delayDays, weekendRule, dayDelays) {
  const d = new Date(txDate);
  const txDayOfWeek = d.getDay();
  const txDayName = DAY_NAMES[txDayOfWeek];

  const delays = typeof dayDelays === 'string' ? JSON.parse(dayDelays || '{}') : (dayDelays || {});
  const effectiveDelay = (delays && delays[txDayName] !== undefined && delays[txDayName] !== null && delays[txDayName] !== '')
    ? parseInt(delays[txDayName])
    : delayDays;

  d.setDate(d.getDate() + effectiveDelay);

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

function isLastDayOfMonth(date) {
  const d = new Date(date);
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return d.getDate() === next.getDate();
}

function isFirstBusinessDay(date) {
  const d = new Date(date);
  if (d.getDate() === 1) {
    return d.getDay() !== 0 && d.getDay() !== 6;
  }
  if (d.getDay() === 1) {
    return d.getDate() <= 3;
  }
  return false;
}

function isLastBusinessDay(date) {
  const d = new Date(date);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  let checkDay = new Date(lastDay);
  while (checkDay.getDay() === 0 || checkDay.getDay() === 6) {
    checkDay.setDate(checkDay.getDate() - 1);
  }
  return d.getDate() === checkDay.getDate();
}

router.get('/credit-date-rules', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, a.name as account_name, c.name as category_name, s.name as studio_name
      FROM credit_date_rules r
      LEFT JOIN accounts a ON r.account_id = a.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN studios s ON r.studio_id = s.id
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
    const { accountId, delayDays, weekendRule, name, categoryId, studioId, dayDelays } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId required' });
    const result = await db.query(
      `INSERT INTO credit_date_rules (account_id, delay_days, weekend_rule, name, category_id, studio_id, day_delays)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [accountId, delayDays || 1, weekendRule || 'next_business_day', name || '', categoryId || null, studioId || null, JSON.stringify(dayDelays || {})]
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating credit date rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/credit-date-rules/:id', async (req, res) => {
  try {
    const { accountId, delayDays, weekendRule, name, enabled, categoryId, studioId, dayDelays } = req.body;
    const result = await db.query(
      `UPDATE credit_date_rules SET account_id=$1, delay_days=$2, weekend_rule=$3, name=$4, enabled=$5, category_id=$6, studio_id=$7, day_delays=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [accountId, delayDays, weekendRule, name || '', enabled !== false, categoryId || null, studioId || null, JSON.stringify(dayDelays || {}), req.params.id]
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
    const { accountId, date, categoryId, studioId } = req.body;
    if (!accountId || !date) return res.status(400).json({ error: 'accountId and date required' });

    const params = [accountId];
    let catParam = '', studioParam = '';
    if (categoryId) {
      params.push(categoryId);
      catParam = '$' + params.length;
    }
    if (studioId) {
      params.push(studioId);
      studioParam = '$' + params.length;
    }

    let query = `SELECT *, 
      CASE 
        WHEN category_id IS NOT NULL AND studio_id IS NOT NULL THEN 4
        WHEN category_id IS NOT NULL THEN 3
        WHEN studio_id IS NOT NULL THEN 2
        ELSE 1
      END as specificity
      FROM credit_date_rules WHERE account_id = $1 AND enabled = true
      AND (category_id IS NULL${catParam ? ` OR category_id = ${catParam}` : ''})
      AND (studio_id IS NULL${studioParam ? ` OR studio_id = ${studioParam}` : ''})
      ORDER BY specificity DESC LIMIT 1`;

    const ruleRes = await db.query(query, params);
    if (ruleRes.rows.length === 0) {
      return res.json({ creditDate: null });
    }
    const rule = ruleRes.rows[0];
    const creditDate = calculateCreditDate(date, rule.delay_days, rule.weekend_rule, rule.day_delays);
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
    const { fromAccountId, toAccountId, schedule, skipWeekends, skipDays, amount, transferAll, description, leaveMinBalance, specificDays, maxAmount, intervalValue } = req.body;
    if (!fromAccountId || !toAccountId) return res.status(400).json({ error: 'fromAccountId and toAccountId required' });
    if (!transferAll && (!amount || parseFloat(amount) <= 0)) return res.status(400).json({ error: 'amount required when not transferring all' });

    const result = await db.query(
      `INSERT INTO auto_transfer_rules (from_account_id, to_account_id, schedule, skip_weekends, skip_days, amount, transfer_all, description, leave_min_balance, specific_days, max_amount, interval_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [fromAccountId, toAccountId, schedule || 'daily', skipWeekends || false, JSON.stringify(skipDays || []),
       transferAll ? null : amount, transferAll || false, description || '',
       leaveMinBalance || 0, JSON.stringify(specificDays || []), maxAmount || null, intervalValue || 1]
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating auto transfer rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/auto-transfer-rules/:id', async (req, res) => {
  try {
    const { fromAccountId, toAccountId, schedule, skipWeekends, skipDays, amount, transferAll, description, enabled, leaveMinBalance, specificDays, maxAmount, intervalValue } = req.body;
    const result = await db.query(
      `UPDATE auto_transfer_rules SET from_account_id=$1, to_account_id=$2, schedule=$3, skip_weekends=$4, skip_days=$5, amount=$6, transfer_all=$7, description=$8, enabled=$9, leave_min_balance=$10, specific_days=$11, max_amount=$12, interval_value=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [fromAccountId, toAccountId, schedule, skipWeekends || false, JSON.stringify(skipDays || []),
       transferAll ? null : amount, transferAll || false, description || '', enabled !== false,
       leaveMinBalance || 0, JSON.stringify(specificDays || []), maxAmount || null, intervalValue || 1, req.params.id]
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
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();
    const dayName = DAY_NAMES[dayOfWeek];
    const dayOfMonth = now.getDate();

    const rules = await db.query(
      `SELECT * FROM auto_transfer_rules WHERE enabled = true AND (last_run_date IS NULL OR last_run_date < $1)`,
      [today]
    );

    const executed = [];
    for (const rule of rules.rows) {
      if (rule.skip_weekends && (dayOfWeek === 0 || dayOfWeek === 6)) continue;

      const skipDays = typeof rule.skip_days === 'string' ? JSON.parse(rule.skip_days) : (rule.skip_days || []);
      if (skipDays.includes(dayName)) continue;

      const specificDays = typeof rule.specific_days === 'string' ? JSON.parse(rule.specific_days) : (rule.specific_days || []);
      const interval = parseInt(rule.interval_value) || 1;

      let shouldRun = false;
      switch (rule.schedule) {
        case 'daily':
          shouldRun = true;
          break;
        case 'weekdays':
          shouldRun = dayOfWeek >= 1 && dayOfWeek <= 5;
          break;
        case 'weekly':
          shouldRun = specificDays.length > 0 && specificDays.includes(dayName);
          break;
        case 'biweekly':
          if (specificDays.length > 0 && specificDays.includes(dayName)) {
            if (rule.last_run_date) {
              const lastRun = new Date(rule.last_run_date);
              const diffDays = Math.floor((now - lastRun) / (1000 * 60 * 60 * 24));
              shouldRun = diffDays >= 14;
            } else {
              shouldRun = true;
            }
          }
          break;
        case 'every_n_days':
          if (rule.last_run_date) {
            const lastRun = new Date(rule.last_run_date);
            const diffDays = Math.floor((now - lastRun) / (1000 * 60 * 60 * 24));
            shouldRun = diffDays >= interval;
          } else {
            shouldRun = true;
          }
          break;
        case 'monthly':
          shouldRun = specificDays.length > 0 && specificDays.includes(dayOfMonth);
          break;
        case 'last_day_of_month':
          shouldRun = isLastDayOfMonth(now);
          break;
        case 'first_business_day':
          shouldRun = isFirstBusinessDay(now);
          break;
        case 'last_business_day':
          shouldRun = isLastBusinessDay(now);
          break;
        default:
          shouldRun = true;
      }

      if (!shouldRun) continue;

      const leaveMin = parseFloat(rule.leave_min_balance) || 0;

      const getSourceBalance = async () => {
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
        return parseFloat(balRes.rows[0]?.balance || 0);
      };

      let transferAmount;
      if (rule.transfer_all) {
        const currentBalance = await getSourceBalance();
        transferAmount = currentBalance - leaveMin;
        if (transferAmount <= 0) continue;
      } else {
        transferAmount = parseFloat(rule.amount);
        if (leaveMin > 0) {
          const currentBalance = await getSourceBalance();
          if (currentBalance - transferAmount < leaveMin) {
            transferAmount = currentBalance - leaveMin;
            if (transferAmount <= 0) continue;
          }
        }
      }

      if (rule.max_amount && transferAmount > parseFloat(rule.max_amount)) {
        transferAmount = parseFloat(rule.max_amount);
      }

      if (transferAmount <= 0) continue;

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
