const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');

router.get('/reconciliation', async (req, res) => {
  try {
    const { settlementAccountId, startDate, endDate } = req.query;
    if (!settlementAccountId || !startDate || !endDate) {
      return res.status(400).json({ error: 'settlementAccountId, startDate, endDate required' });
    }

    const accRes = await db.query('SELECT id, name, initial_balance FROM accounts WHERE id = $1', [settlementAccountId]);
    if (accRes.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    const account = accRes.rows[0];

    const incomeQuery = `
      SELECT COALESCE(t.credit_date, t.date)::date as day, SUM(t.amount) as total
      FROM transactions t
      WHERE t.settlement_account_id = $1
        AND t.type = 'income'
        AND COALESCE(t.credit_date, t.date) >= $2::date
        AND COALESCE(t.credit_date, t.date) <= $3::date
      GROUP BY day
      ORDER BY day
    `;

    const expenseQuery = `
      SELECT t.date::date as day, SUM(t.amount) as total
      FROM transactions t
      WHERE t.account_id = $1
        AND t.type = 'expense'
        AND t.status IN ('paid', 'verified')
        AND t.date >= $2::date
        AND t.date <= $3::date
      GROUP BY day
      ORDER BY day
    `;

    const transferOutQuery = `
      SELECT t.date::date as day, SUM(t.amount) as total
      FROM transactions t
      WHERE t.account_id = $1
        AND t.type = 'transfer'
        AND (t.confirmed = true OR t.status IN ('paid', 'verified'))
        AND t.date >= $2::date
        AND t.date <= $3::date
      GROUP BY day
      ORDER BY day
    `;

    const transferInQuery = `
      SELECT t.date::date as day, SUM(t.amount) as total
      FROM transactions t
      WHERE t.to_account_id = $1
        AND t.type = 'transfer'
        AND (t.confirmed = true OR t.status IN ('paid', 'verified'))
        AND t.date >= $2::date
        AND t.date <= $3::date
      GROUP BY day
      ORDER BY day
    `;

    const initialBal = Number(account.initial_balance) || 0;
    const balanceBeforeQuery = `
      SELECT
        ${initialBal}::numeric + COALESCE((
          SELECT SUM(CASE
            WHEN t.settlement_account_id = $1 AND t.type = 'income' THEN t.amount
            WHEN t.account_id = $1 AND t.type = 'expense' AND t.status IN ('paid', 'verified') THEN -t.amount
            WHEN t.account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified')) THEN -t.amount
            WHEN t.to_account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified')) THEN t.amount
            ELSE 0
          END)
          FROM transactions t
          WHERE (t.settlement_account_id = $1 OR t.account_id = $1 OR t.to_account_id = $1)
            AND CASE
              WHEN t.type = 'income' THEN COALESCE(t.credit_date, t.date) < $2::date
              ELSE t.date < $2::date
            END
        ), 0) as balance_before
    `;

    const incomeDetailsQuery = `
      SELECT t.id, COALESCE(t.credit_date, t.date)::date as day, t.amount, t.description,
        a.name as from_account_name, c.name as category_name, s.name as studio_name, t.status
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN studios s ON t.studio_id = s.id
      WHERE t.settlement_account_id = $1
        AND t.type = 'income'
        AND COALESCE(t.credit_date, t.date) >= $2::date
        AND COALESCE(t.credit_date, t.date) <= $3::date
      ORDER BY COALESCE(t.credit_date, t.date), t.created_at
    `;

    const expenseDetailsQuery = `
      SELECT t.id, t.date::date as day, t.amount, t.description,
        c.name as category_name, s.name as studio_name, co.name as contractor_name, t.status
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN studios s ON t.studio_id = s.id
      LEFT JOIN contractors co ON t.contractor_id = co.id
      WHERE t.account_id = $1
        AND t.type = 'expense'
        AND t.status IN ('paid', 'verified')
        AND t.date >= $2::date
        AND t.date <= $3::date
      ORDER BY t.date, t.created_at
    `;

    const transferDetailsQuery = `
      SELECT t.id, t.date::date as day, t.amount, t.description, t.type,
        a_from.name as from_account_name, a_to.name as to_account_name,
        CASE WHEN t.account_id = $1 THEN 'out' ELSE 'in' END as direction
      FROM transactions t
      LEFT JOIN accounts a_from ON t.account_id = a_from.id
      LEFT JOIN accounts a_to ON t.to_account_id = a_to.id
      WHERE t.type = 'transfer'
        AND (t.confirmed = true OR t.status IN ('paid', 'verified'))
        AND (t.account_id = $1 OR t.to_account_id = $1)
        AND t.date >= $2::date
        AND t.date <= $3::date
      ORDER BY t.date, t.created_at
    `;

    const [incomeRes, expenseRes, transferOutRes, transferInRes, balanceRes, incomeDetails, expenseDetails, transferDetails] = await Promise.all([
      db.query(incomeQuery, [settlementAccountId, startDate, endDate]),
      db.query(expenseQuery, [settlementAccountId, startDate, endDate]),
      db.query(transferOutQuery, [settlementAccountId, startDate, endDate]),
      db.query(transferInQuery, [settlementAccountId, startDate, endDate]),
      db.query(balanceBeforeQuery, [settlementAccountId, startDate]),
      db.query(incomeDetailsQuery, [settlementAccountId, startDate, endDate]),
      db.query(expenseDetailsQuery, [settlementAccountId, startDate, endDate]),
      db.query(transferDetailsQuery, [settlementAccountId, startDate, endDate]),
    ]);

    const toDateStr = (d) => {
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };

    const incomeByDay = {};
    incomeRes.rows.forEach(r => { incomeByDay[toDateStr(r.day)] = Number(r.total); });

    const expenseByDay = {};
    expenseRes.rows.forEach(r => { expenseByDay[toDateStr(r.day)] = Number(r.total); });

    const transferOutByDay = {};
    transferOutRes.rows.forEach(r => { transferOutByDay[toDateStr(r.day)] = Number(r.total); });

    const transferInByDay = {};
    transferInRes.rows.forEach(r => { transferInByDay[toDateStr(r.day)] = Number(r.total); });

    const balanceBefore = Number(balanceRes.rows[0].balance_before);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    let runningBalance = balanceBefore;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const income = incomeByDay[dateStr] || 0;
      const expense = expenseByDay[dateStr] || 0;
      const transferOut = transferOutByDay[dateStr] || 0;
      const transferIn = transferInByDay[dateStr] || 0;

      const dayIncomeDetails = incomeDetails.rows
        .filter(r => toDateStr(r.day) === dateStr)
        .map(toCamelCase);
      const dayExpenseDetails = expenseDetails.rows
        .filter(r => toDateStr(r.day) === dateStr)
        .map(toCamelCase);
      const dayTransferDetails = transferDetails.rows
        .filter(r => toDateStr(r.day) === dateStr)
        .map(toCamelCase);

      const openBalance = runningBalance;
      const netChange = income - expense - transferOut + transferIn;
      runningBalance = openBalance + netChange;

      days.push({
        date: dateStr,
        openBalance,
        income,
        expense,
        transferOut,
        transferIn,
        closeBalance: runningBalance,
        incomeDetails: dayIncomeDetails,
        expenseDetails: dayExpenseDetails,
        transferDetails: dayTransferDetails,
      });
    }

    res.json({
      accountId: account.id,
      accountName: account.name,
      startDate,
      endDate,
      balanceBefore,
      days,
    });
  } catch (err) {
    console.error('Reconciliation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reconciliation/accounts', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT a.id, a.name
      FROM accounts a
      WHERE a.id IN (
        SELECT DISTINCT settlement_account_id FROM settlement_rules WHERE enabled = true
        UNION
        SELECT DISTINCT settlement_account_id FROM transactions WHERE settlement_account_id IS NOT NULL
      )
      ORDER BY a.name
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching reconciliation accounts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
