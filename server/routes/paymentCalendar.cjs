const express = require('express');
const router = express.Router();
const db = require('../db.cjs');

async function requireAdmin(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const userRes = await db.query('SELECT id, role FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) { res.status(401).json({ error: 'User not found' }); return null; }
  const user = userRes.rows[0];
  if (!['admin', 'payout_controller', 'requester'].includes(user.role)) {
    res.status(403).json({ error: 'Forbidden' }); return null;
  }
  return user;
}

router.get('/payment-calendar', async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month required in YYYY-MM format' });
    }

    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
    const nextMonthDate = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

    const incomeRes = await db.query(
      `SELECT
        EXTRACT(DAY FROM COALESCE(t.credit_date, t.date))::int AS day,
        SUM(t.amount) AS plan_amount,
        SUM(CASE WHEN t.confirmed THEN t.amount ELSE 0 END) AS fact_amount
       FROM transactions t
       WHERE t.type = 'income'
         AND COALESCE(t.credit_date, t.date) >= $1 AND COALESCE(t.credit_date, t.date) < $2
       GROUP BY EXTRACT(DAY FROM COALESCE(t.credit_date, t.date))
       ORDER BY day`,
      [startDate, nextMonthDate]
    );

    const prRes = await db.query(
      `SELECT
        pr.id, pr.amount, pr.paid_amount, pr.status,
        pr.payment_date, pr.accrual_date, pr.description,
        pr.category_id, c.name AS category_name,
        u.username, pr.created_at,
        co.name AS contractor_name
       FROM payment_requests pr
       LEFT JOIN categories c ON pr.category_id = c.id
       LEFT JOIN users u ON pr.user_id = u.id
       LEFT JOIN contractors co ON pr.contractor_id = co.id
       WHERE pr.status != 'rejected'
         AND pr.payment_date >= $1 AND pr.payment_date < $2
       ORDER BY pr.category_id, pr.payment_date, pr.id`,
      [startDate, nextMonthDate]
    );

    const directExpenseRes = await db.query(
      `SELECT
        t.id, t.amount, t.date, t.accrual_date, t.description, t.confirmed, t.status,
        t.category_id, c.name AS category_name,
        co.name AS contractor_name,
        t.created_at
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN contractors co ON t.contractor_id = co.id
       WHERE t.type = 'expense'
         AND (t.external_id IS NULL OR t.external_id NOT LIKE 'pr-%')
         AND t.date >= $1 AND t.date < $2
       ORDER BY t.category_id, t.date, t.id`,
      [startDate, nextMonthDate]
    );

    const incomePlan = {};
    const incomeFact = {};
    for (const r of incomeRes.rows) {
      const d = r.day;
      incomePlan[d] = (incomePlan[d] || 0) + parseFloat(r.plan_amount || 0);
      incomeFact[d] = (incomeFact[d] || 0) + parseFloat(r.fact_amount || 0);
    }

    const expensePlan = {};
    const expenseFact = {};
    const categoryMap = {};

    for (const pr of prRes.rows) {
      const payDate = new Date(pr.payment_date);
      const day = payDate.getUTCDate();
      const amount = parseFloat(pr.amount || 0);
      const paidAmount = parseFloat(pr.paid_amount || pr.amount || 0);

      expensePlan[day] = (expensePlan[day] || 0) + amount;
      if (pr.status === 'paid' || pr.status === 'verified') {
        expenseFact[day] = (expenseFact[day] || 0) + paidAmount;
      }

      const catId = pr.category_id != null ? String(pr.category_id) : '0';
      const catName = pr.category_name || 'Без категории';
      if (!categoryMap[catId]) {
        categoryMap[catId] = { id: catId, name: catName, days: {} };
      }
      if (!categoryMap[catId].days[day]) {
        categoryMap[catId].days[day] = [];
      }
      categoryMap[catId].days[day].push({
        id: pr.id,
        source: 'pr',
        amount,
        status: pr.status,
        description: pr.description || '',
        username: pr.username || '',
        contractorName: pr.contractor_name || '',
        createdAt: pr.created_at,
        paymentDate: pr.payment_date ? (pr.payment_date instanceof Date ? pr.payment_date : new Date(pr.payment_date)).toISOString().slice(0, 10) : null,
        accrualDate: pr.accrual_date ? (pr.accrual_date instanceof Date ? pr.accrual_date : new Date(pr.accrual_date)).toISOString().slice(0, 10) : null,
      });
    }

    for (const tx of directExpenseRes.rows) {
      const txDate = new Date(tx.date);
      const day = txDate.getUTCDate();
      const amount = parseFloat(tx.amount || 0);

      expensePlan[day] = (expensePlan[day] || 0) + amount;
      const txSt = tx.status || (tx.confirmed ? 'verified' : 'pending');
      if (txSt === 'paid' || txSt === 'verified') {
        expenseFact[day] = (expenseFact[day] || 0) + amount;
      }

      const catId = tx.category_id != null ? String(tx.category_id) : '0';
      const catName = tx.category_name || 'Без категории';
      if (!categoryMap[catId]) {
        categoryMap[catId] = { id: catId, name: catName, days: {} };
      }
      if (!categoryMap[catId].days[day]) {
        categoryMap[catId].days[day] = [];
      }

      let txStatus = tx.status || 'pending';
      if (tx.confirmed && txStatus === 'pending') txStatus = 'paid';

      categoryMap[catId].days[day].push({
        id: tx.id,
        source: 'tx',
        amount,
        status: txStatus,
        description: tx.description || '',
        username: '',
        contractorName: tx.contractor_name || '',
        createdAt: tx.created_at,
        paymentDate: tx.date ? (tx.date instanceof Date ? tx.date : new Date(tx.date)).toISOString().slice(0, 10) : null,
        accrualDate: tx.accrual_date ? (tx.accrual_date instanceof Date ? tx.accrual_date : new Date(tx.accrual_date)).toISOString().slice(0, 10) : null,
      });
    }

    // Real account balances (current)
    const accountsRes = await db.query(`
      SELECT a.id, a.name, a.currency,
        COALESCE(a.initial_balance, 0) + COALESCE((
          SELECT SUM(
            CASE
              WHEN t.type = 'income'   AND t.account_id    = a.id THEN  t.amount
              WHEN t.type = 'expense'  AND t.account_id    = a.id THEN -t.amount
              WHEN t.type = 'transfer' AND t.account_id    = a.id THEN -t.amount
              WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN  t.amount
              ELSE 0
            END
          ) FROM transactions t
          WHERE (t.account_id = a.id OR t.to_account_id = a.id)
            AND (t.confirmed = true OR (t.type = 'expense' AND t.status IN ('paid', 'verified')))
            AND COALESCE(t.credit_date, t.date) <= CURRENT_DATE
        ), 0) AS balance
      FROM accounts a
      ORDER BY a.name
    `);

    // Balance at start of selected month
    const startBalRes = await db.query(`
      SELECT COALESCE(SUM(
        COALESCE(a.initial_balance, 0) + COALESCE((
          SELECT SUM(
            CASE
              WHEN t.type = 'income'   AND t.account_id    = a.id THEN  t.amount
              WHEN t.type = 'expense'  AND t.account_id    = a.id THEN -t.amount
              WHEN t.type = 'transfer' AND t.account_id    = a.id THEN -t.amount
              WHEN t.type = 'transfer' AND t.to_account_id = a.id THEN  t.amount
              ELSE 0
            END
          ) FROM transactions t
          WHERE (t.account_id = a.id OR t.to_account_id = a.id)
            AND (t.confirmed = true OR (t.type = 'expense' AND t.status IN ('paid', 'verified')))
            AND COALESCE(t.credit_date, t.date) < $1
        ), 0)
      ), 0) AS starting_balance
      FROM accounts a
    `, [startDate]);

    const startingBalance = parseFloat(startBalRes.rows[0]?.starting_balance || 0);
    const accountBalances = accountsRes.rows.map(r => ({
      id: r.id,
      name: r.name,
      currency: r.currency || 'RUB',
      balance: parseFloat(r.balance || 0),
    }));

    let running = startingBalance;
    const balance = {};
    for (let d = 1; d <= daysInMonth; d++) {
      running += (incomeFact[d] || 0) - (expenseFact[d] || 0);
      balance[d] = running;
    }

    const expenseCategories = Object.values(categoryMap)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    res.json({
      daysInMonth,
      startingBalance,
      accountBalances,
      incomePlan,
      incomeFact,
      expensePlan,
      expenseFact,
      balance,
      expenseCategories,
    });
  } catch (err) {
    console.error('Error fetching payment calendar:', err);
    res.status(500).json({ error: 'Error fetching payment calendar' });
  }
});

router.patch('/payment-calendar/move-payment', async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  const { ids, newDate } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0 || !newDate) {
    return res.status(400).json({ error: 'ids (array) and newDate (YYYY-MM-DD) required' });
  }
  try {
    await db.query(
      `UPDATE payment_requests SET payment_date = $1 WHERE id = ANY($2::int[])`,
      [newDate, ids]
    );
    const externalIds = ids.map(id => `pr-${id}`);
    await db.query(
      `UPDATE transactions SET date = $1, updated_at = NOW() WHERE external_id = ANY($2::text[])`,
      [newDate, externalIds]
    );
    res.json({ ok: true, moved: ids.length });
  } catch (err) {
    console.error('Error moving payments:', err);
    res.status(500).json({ error: 'Error moving payments' });
  }
});

router.post('/payment-calendar/split-payment', async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;
  const { id, parts } = req.body;
  if (!id || !Array.isArray(parts) || parts.length < 2) {
    return res.status(400).json({ error: 'id and parts (array of {amount, date}, min 2) required' });
  }
  for (const p of parts) {
    if (!p.amount || isNaN(parseFloat(p.amount)) || parseFloat(p.amount) <= 0 || !p.date) {
      return res.status(400).json({ error: 'Each part must have a positive amount and a date' });
    }
  }
  try {
    const orig = await db.query('SELECT * FROM payment_requests WHERE id = $1', [id]);
    if (orig.rows.length === 0) return res.status(404).json({ error: 'Payment request not found' });
    const o = orig.rows[0];

    const totalParts = parts.reduce((s, p) => s + parseFloat(p.amount), 0);
    const originalAmount = parseFloat(o.amount);
    if (Math.abs(totalParts - originalAmount) > 0.01) {
      return res.status(400).json({ error: `Sum of parts (${totalParts}) does not match original amount (${originalAmount})` });
    }

    await db.query(
      `UPDATE payment_requests SET amount = $1, payment_date = $2 WHERE id = $3`,
      [parseFloat(parts[0].amount), parts[0].date, id]
    );
    await db.query(
      `UPDATE transactions SET amount = $1, date = $2, updated_at = NOW() WHERE external_id = $3`,
      [parseFloat(parts[0].amount), parts[0].date, `pr-${id}`]
    );

    for (let i = 1; i < parts.length; i++) {
      const newPr = await db.query(
        `INSERT INTO payment_requests
           (user_id, amount, category_id, studio_id, contractor_id, account_id, description, payment_date, accrual_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [o.user_id, parseFloat(parts[i].amount), o.category_id, o.studio_id, o.contractor_id, o.account_id, o.description, parts[i].date, o.accrual_date, o.status]
      );
      const newPrId = newPr.rows[0].id;
      await db.query(
        `INSERT INTO transactions (date, amount, type, account_id, category_id, studio_id, contractor_id, description, confirmed, accrual_date, external_id, status)
         VALUES ($1, $2, 'expense', $3, $4, $5, $6, $7, false, $8, $9, $10)`,
        [parts[i].date, parseFloat(parts[i].amount), o.account_id, o.category_id, o.studio_id, o.contractor_id, o.description, o.accrual_date, `pr-${newPrId}`, o.status || 'pending']
      );
    }

    res.json({ ok: true, split: parts.length });
  } catch (err) {
    console.error('Error splitting payment:', err);
    res.status(500).json({ error: 'Error splitting payment' });
  }
});

module.exports = router;
