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
        EXTRACT(DAY FROM t.date)::int AS day,
        SUM(t.amount) AS plan_amount,
        SUM(CASE WHEN t.confirmed THEN t.amount ELSE 0 END) AS fact_amount
       FROM transactions t
       WHERE t.type = 'income'
         AND t.date >= $1 AND t.date < $2
       GROUP BY EXTRACT(DAY FROM t.date)
       ORDER BY day`,
      [startDate, nextMonthDate]
    );

    const prRes = await db.query(
      `SELECT
        pr.id, pr.amount, pr.paid_amount, pr.status,
        pr.payment_date, pr.description,
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
      if (pr.status === 'paid') {
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
        amount,
        status: pr.status,
        description: pr.description || '',
        username: pr.username || '',
        contractorName: pr.contractor_name || '',
        createdAt: pr.created_at,
      });
    }

    let running = 0;
    const balance = {};
    for (let d = 1; d <= daysInMonth; d++) {
      running += (incomeFact[d] || 0) - (expenseFact[d] || 0);
      balance[d] = running;
    }

    const expenseCategories = Object.values(categoryMap)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    res.json({
      daysInMonth,
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

module.exports = router;
