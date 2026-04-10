const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { calculateCreditDate, loadHolidays, clearHolidayCache } = require('../utils/creditDate.cjs');
const { getMoscowNow, getMoscowToday } = require('../utils/moscow.cjs');

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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
    const holidays = await loadHolidays();
    const creditDate = calculateCreditDate(date, rule.delay_days, rule.weekend_rule, rule.day_delays, holidays);
    res.json({ creditDate });
  } catch (err) {
    console.error('Error calculating credit date:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/credit-date-rules/:id/apply', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const { dateFrom, dateTo } = req.body || {};
    const ruleRes = await db.query('SELECT * FROM credit_date_rules WHERE id = $1', [ruleId]);
    if (ruleRes.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    const rule = ruleRes.rows[0];

    const conditions = ['t.account_id = $1', "t.type = 'income'"];
    const params = [rule.account_id];
    if (rule.category_id) {
      params.push(rule.category_id);
      conditions.push(`t.category_id = $${params.length}`);
    }
    if (rule.studio_id) {
      params.push(rule.studio_id);
      conditions.push(`t.studio_id = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`t.date >= $${params.length}`);
    }
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`t.date <= $${params.length}`);
    }

    const txRes = await db.query(
      `SELECT t.id, t.date FROM transactions t WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (txRes.rows.length === 0) {
      return res.json({ updated: 0, message: 'Подходящих операций не найдено' });
    }

    const holidays = await loadHolidays();
    let updated = 0;
    for (const tx of txRes.rows) {
      const txDate = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date).split('T')[0];
      const creditDate = calculateCreditDate(txDate, rule.delay_days, rule.weekend_rule, rule.day_delays, holidays);
      await db.query('UPDATE transactions SET credit_date = $1 WHERE id = $2', [creditDate, tx.id]);
      updated++;
    }

    res.json({ updated, message: `Обновлено операций: ${updated}` });
  } catch (err) {
    console.error('Error applying credit date rule:', err);
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
    const now = getMoscowNow();
    const today = getMoscowToday();
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

router.get('/holidays', async (req, res) => {
  try {
    const { year } = req.query;
    let query = 'SELECT * FROM holidays';
    const params = [];
    if (year) {
      query += ' WHERE EXTRACT(YEAR FROM date) = $1';
      params.push(year);
    }
    query += ' ORDER BY date';
    const result = await db.query(query, params);
    res.json(result.rows.map(r => ({
      id: r.id,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      name: r.name,
      affectsCredit: r.affects_credit,
    })));
  } catch (err) {
    console.error('Error fetching holidays:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/holidays', async (req, res) => {
  try {
    const { date, name, affectsCredit } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    const result = await db.query(
      'INSERT INTO holidays (date, name, affects_credit) VALUES ($1, $2, $3) ON CONFLICT (date) DO UPDATE SET name = $2, affects_credit = $3 RETURNING *',
      [date, name || '', affectsCredit !== false]
    );
    const r = result.rows[0];
    clearHolidayCache();
    res.json({ id: r.id, date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0], name: r.name, affectsCredit: r.affects_credit });
  } catch (err) {
    console.error('Error creating holiday:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/holidays/bulk', async (req, res) => {
  try {
    const { holidays } = req.body;
    if (!Array.isArray(holidays)) return res.status(400).json({ error: 'holidays array required' });
    let added = 0;
    for (const h of holidays) {
      if (!h.date) continue;
      const r = await db.query(
        'INSERT INTO holidays (date, name, affects_credit) VALUES ($1, $2, $3) ON CONFLICT (date) DO NOTHING',
        [h.date, h.name || '', h.affectsCredit !== false]
      );
      if (r.rowCount > 0) added++;
    }
    clearHolidayCache();
    res.json({ success: true, added });
  } catch (err) {
    console.error('Error bulk creating holidays:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/holidays/:id', async (req, res) => {
  try {
    const { date, name, affectsCredit } = req.body;
    const result = await db.query(
      'UPDATE holidays SET date = COALESCE($1, date), name = COALESCE($2, name), affects_credit = COALESCE($3, affects_credit) WHERE id = $4 RETURNING *',
      [date || null, name !== undefined ? name : null, affectsCredit !== undefined ? affectsCredit : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    clearHolidayCache();
    res.json({ id: r.id, date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0], name: r.name, affectsCredit: r.affects_credit });
  } catch (err) {
    console.error('Error updating holiday:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/holidays/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM holidays WHERE id = $1', [req.params.id]);
    clearHolidayCache();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting holiday:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/settlement-rules', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sr.*, a.name as account_name, sa.name as settlement_account_name,
             c.name as category_name, s.name as studio_name
      FROM settlement_rules sr
      LEFT JOIN accounts a ON sr.account_id = a.id
      LEFT JOIN accounts sa ON sr.settlement_account_id = sa.id
      LEFT JOIN categories c ON sr.category_id = c.id
      LEFT JOIN studios s ON sr.studio_id = s.id
      ORDER BY sr.id
    `);
    res.json(result.rows.map(r => toCamelCase(r)));
  } catch (err) {
    console.error('Error fetching settlement rules:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/settlement-rules/resolve', async (req, res) => {
  try {
    const { accountId, categoryId, studioId } = req.body;
    if (!accountId) return res.json({ settlementAccountId: null, settlementAccountName: null });
    const { resolveSettlementAccount } = require('../utils/creditDate.cjs');
    const saId = await resolveSettlementAccount(accountId, categoryId || null, studioId || null);
    if (!saId) return res.json({ settlementAccountId: null, settlementAccountName: null });
    const accRes = await db.query('SELECT name FROM accounts WHERE id = $1', [saId]);
    res.json({ settlementAccountId: saId, settlementAccountName: accRes.rows[0]?.name || null });
  } catch (err) {
    console.error('Error resolving settlement account:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/settlement-rules', async (req, res) => {
  try {
    const { accountId, categoryId, studioId, settlementAccountId } = req.body;
    if (!accountId || !settlementAccountId) return res.status(400).json({ error: 'accountId and settlementAccountId required' });
    const result = await db.query(
      'INSERT INTO settlement_rules (account_id, category_id, studio_id, settlement_account_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [accountId, categoryId || null, studioId || null, settlementAccountId]
    );
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error creating settlement rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/settlement-rules/:id', async (req, res) => {
  try {
    const { accountId, categoryId, studioId, settlementAccountId, enabled } = req.body;
    const result = await db.query(
      `UPDATE settlement_rules SET account_id = $1, category_id = $2, studio_id = $3, settlement_account_id = $4, enabled = $5 WHERE id = $6 RETURNING *`,
      [accountId, categoryId || null, studioId || null, settlementAccountId, enabled !== false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating settlement rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/settlement-rules/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM settlement_rules WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting settlement rule:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
