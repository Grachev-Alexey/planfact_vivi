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
      WHERE (t.settlement_account_id = $1 OR (t.account_id = $1 AND t.settlement_account_id IS NULL))
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

    const settlementExclude = `
        AND NOT EXISTS (
          SELECT 1 FROM settlement_rules sr
          WHERE sr.enabled = true
            AND sr.account_id = t.account_id
            AND sr.settlement_account_id = t.to_account_id
        )`;

    const transferOutQuery = `
      SELECT t.date::date as day, SUM(t.amount) as total
      FROM transactions t
      WHERE t.account_id = $1
        AND t.type = 'transfer'
        AND (t.confirmed = true OR t.status IN ('paid', 'verified'))
        AND t.date >= $2::date
        AND t.date <= $3::date
        ${settlementExclude}
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
        ${settlementExclude}
      GROUP BY day
      ORDER BY day
    `;

    const initialBal = Number(account.initial_balance) || 0;
    const balanceBeforeQuery = `
      SELECT
        ${initialBal}::numeric + COALESCE((
          SELECT SUM(CASE
            WHEN (t.settlement_account_id = $1 OR (t.account_id = $1 AND t.settlement_account_id IS NULL)) AND t.type = 'income' THEN t.amount
            WHEN t.account_id = $1 AND t.type = 'expense' AND t.status IN ('paid', 'verified') THEN -t.amount
            WHEN t.account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified'))
              AND NOT EXISTS (SELECT 1 FROM settlement_rules sr WHERE sr.enabled = true AND sr.account_id = t.account_id AND sr.settlement_account_id = t.to_account_id)
              THEN -t.amount
            WHEN t.to_account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified'))
              AND NOT EXISTS (SELECT 1 FROM settlement_rules sr WHERE sr.enabled = true AND sr.account_id = t.account_id AND sr.settlement_account_id = t.to_account_id)
              THEN t.amount
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
      WHERE (t.settlement_account_id = $1 OR (t.account_id = $1 AND t.settlement_account_id IS NULL))
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
        ${settlementExclude}
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

router.get('/reconciliation/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate, endDate required' });

    const accountsRes = await db.query(`
      SELECT DISTINCT a.id, a.name, a.initial_balance
      FROM accounts a
      WHERE a.id IN (
        SELECT DISTINCT settlement_account_id FROM settlement_rules WHERE enabled = true
        UNION
        SELECT DISTINCT settlement_account_id FROM transactions WHERE settlement_account_id IS NOT NULL
      )
      OR a.name ILIKE '%бухгалтер%'
      ORDER BY a.name
    `);

    if (accountsRes.rows.length === 0) return res.json({ accounts: [], days: [] });

    const toDateStr = (d) => {
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };

    const accountSummaries = [];
    let totalBalanceBefore = 0;

    for (const account of accountsRes.rows) {
      const accId = account.id;
      const initialBal = Number(account.initial_balance) || 0;

      const incomeCondition = `(t.settlement_account_id = $1 OR (t.account_id = $1 AND t.settlement_account_id IS NULL))`;
      const settlementExcl = `AND NOT EXISTS (SELECT 1 FROM settlement_rules sr WHERE sr.enabled = true AND sr.account_id = t.account_id AND sr.settlement_account_id = t.to_account_id)`;

      const [incomeRes, expenseRes, transferOutRes, transferInRes, balanceRes] = await Promise.all([
        db.query(`SELECT COALESCE(t.credit_date, t.date)::date as day, SUM(t.amount) as total FROM transactions t WHERE ${incomeCondition} AND t.type = 'income' AND COALESCE(t.credit_date, t.date) >= $2::date AND COALESCE(t.credit_date, t.date) <= $3::date GROUP BY day`, [accId, startDate, endDate]),
        db.query(`SELECT t.date::date as day, SUM(t.amount) as total FROM transactions t WHERE t.account_id = $1 AND t.type = 'expense' AND t.status IN ('paid', 'verified') AND t.date >= $2::date AND t.date <= $3::date GROUP BY day`, [accId, startDate, endDate]),
        db.query(`SELECT t.date::date as day, SUM(t.amount) as total FROM transactions t WHERE t.account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified')) ${settlementExcl} AND t.date >= $2::date AND t.date <= $3::date GROUP BY day`, [accId, startDate, endDate]),
        db.query(`SELECT t.date::date as day, SUM(t.amount) as total FROM transactions t WHERE t.to_account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified')) ${settlementExcl} AND t.date >= $2::date AND t.date <= $3::date GROUP BY day`, [accId, startDate, endDate]),
        db.query(`SELECT ${initialBal}::numeric + COALESCE((SELECT SUM(CASE WHEN ${incomeCondition} AND t.type = 'income' THEN t.amount WHEN t.account_id = $1 AND t.type = 'expense' AND t.status IN ('paid', 'verified') THEN -t.amount WHEN t.account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified')) ${settlementExcl} THEN -t.amount WHEN t.to_account_id = $1 AND t.type = 'transfer' AND (t.confirmed = true OR t.status IN ('paid', 'verified')) ${settlementExcl} THEN t.amount ELSE 0 END) FROM transactions t WHERE (${incomeCondition} OR t.account_id = $1 OR t.to_account_id = $1) AND CASE WHEN t.type = 'income' THEN COALESCE(t.credit_date, t.date) < $2::date ELSE t.date < $2::date END), 0) as balance_before`, [accId, startDate]),
      ]);

      const incomeByDay = {}; incomeRes.rows.forEach(r => { incomeByDay[toDateStr(r.day)] = Number(r.total); });
      const expenseByDay = {}; expenseRes.rows.forEach(r => { expenseByDay[toDateStr(r.day)] = Number(r.total); });
      const transferOutByDay = {}; transferOutRes.rows.forEach(r => { transferOutByDay[toDateStr(r.day)] = Number(r.total); });
      const transferInByDay = {}; transferInRes.rows.forEach(r => { transferInByDay[toDateStr(r.day)] = Number(r.total); });
      const balanceBefore = Number(balanceRes.rows[0].balance_before);
      totalBalanceBefore += balanceBefore;

      accountSummaries.push({ id: accId, name: account.name, balanceBefore, incomeByDay, expenseByDay, transferOutByDay, transferInByDay });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = [];
    const accountRunning = {};
    accountSummaries.forEach(a => { accountRunning[a.id] = a.balanceBefore; });

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let totalIncome = 0, totalExpense = 0, totalTransferOut = 0, totalTransferIn = 0;
      const perAccount = [];

      for (const acc of accountSummaries) {
        const inc = acc.incomeByDay[dateStr] || 0;
        const exp = acc.expenseByDay[dateStr] || 0;
        const trOut = acc.transferOutByDay[dateStr] || 0;
        const trIn = acc.transferInByDay[dateStr] || 0;
        const openBal = accountRunning[acc.id];
        const net = inc - exp - trOut + trIn;
        accountRunning[acc.id] = openBal + net;
        totalIncome += inc; totalExpense += exp;
        totalTransferOut += trOut; totalTransferIn += trIn;
        if (inc > 0 || exp > 0 || trOut > 0 || trIn > 0) {
          perAccount.push({ accountId: acc.id, accountName: acc.name, income: inc, expense: exp, transferOut: trOut, transferIn: trIn, openBalance: openBal, closeBalance: accountRunning[acc.id] });
        }
      }

      const totalClose = Object.values(accountRunning).reduce((s, v) => s + v, 0);
      const totalOpen = totalClose + (totalExpense - totalIncome + totalTransferOut - totalTransferIn);

      days.push({ date: dateStr, income: totalIncome, expense: totalExpense, transferOut: totalTransferOut, transferIn: totalTransferIn, openBalance: totalOpen, closeBalance: totalClose, perAccount });
    }

    res.json({
      balanceBefore: totalBalanceBefore,
      accounts: accountSummaries.map(a => ({ id: a.id, name: a.name, balanceBefore: a.balanceBefore, closeBalance: accountRunning[a.id] })),
      days,
    });
  } catch (err) {
    console.error('Reconciliation summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reconciliation/accounts', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT a.id, a.name, a.bank_type, a.bank_account_number, CASE WHEN a.bank_api_key IS NOT NULL AND a.bank_api_key != '' THEN true ELSE false END as has_bank_key
      FROM accounts a
      WHERE a.id IN (
        SELECT DISTINCT settlement_account_id FROM settlement_rules WHERE enabled = true
        UNION
        SELECT DISTINCT settlement_account_id FROM transactions WHERE settlement_account_id IS NOT NULL
      )
      OR a.name ILIKE '%бухгалтер%'
      ORDER BY a.name
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching reconciliation accounts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reconciliation/bank-statement', async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.query;
    if (!accountId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Необходимы параметры: счёт, дата начала и дата окончания' });
    }

    const accRes = await db.query('SELECT id, name, bank_api_key, bank_type, bank_account_number FROM accounts WHERE id = $1', [accountId]);
    if (accRes.rows.length === 0) return res.status(404).json({ error: 'Счёт не найден' });
    const account = accRes.rows[0];

    if (!account.bank_api_key || !account.bank_type) {
      return res.status(400).json({ error: 'Банковская интеграция не настроена для этого счёта' });
    }

    let bankAccountNumber = account.bank_account_number;
    if (!bankAccountNumber && account.bank_type === 'tbank') {
      try {
        const accListResp = await fetch('https://business.tbank.ru/openapi/api/v1/bank-accounts', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${account.bank_api_key}`, 'Accept': 'application/json' }
        });
        if (accListResp.ok) {
          const accList = await accListResp.json();
          if (accList && accList.length > 0) {
            bankAccountNumber = accList[0].accountNumber;
            await db.query('UPDATE accounts SET bank_account_number = $1 WHERE id = $2', [bankAccountNumber, accountId]);
          }
        }
      } catch (e) { console.error('Auto-fetch bank accounts failed:', e.message); }
    }
    if (!bankAccountNumber) {
      return res.status(400).json({ error: 'Не удалось определить номер расчётного счёта. Укажите его в настройках счёта (Справочники → Счета)' });
    }

    let statements = [];

    if (account.bank_type === 'tbank') {
      try {
        const resp = await fetch(`https://business.tbank.ru/openapi/api/v1/statement?accountNumber=${encodeURIComponent(bankAccountNumber)}&from=${encodeURIComponent(startDate + 'T00:00:00Z')}&to=${encodeURIComponent(endDate + 'T23:59:59Z')}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${account.bank_api_key}`
          }
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('T-Bank API error:', resp.status, errText);
          return res.status(resp.status).json({ error: `Ошибка Т-Банк API: ${errText}` });
        }
        const data = await resp.json();
        const ops = data.operation || data.operations || [];
        statements = ops.map(op => ({
          date: (op.date || op.operationDate || '').split('T')[0],
          amount: parseFloat(op.amount || op.operationAmount || 0),
          description: op.paymentPurpose || op.narrative || op.description || '',
          counterparty: op.counterpartyName || op.corresondentName || '',
          type: parseFloat(op.amount || op.operationAmount || 0) > 0 ? 'income' : 'expense'
        }));
      } catch (fetchErr) {
        return res.status(502).json({ error: `Ошибка подключения к Т-Банк: ${fetchErr.message}` });
      }
    } else if (account.bank_type === 'sber') {
      try {
        const resp = await fetch('https://api.sberbank.ru/fintech/v1/statement', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${account.bank_api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountNumber: bankAccountNumber,
            dateFrom: startDate,
            dateTo: endDate
          })
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('Sber API error:', resp.status, errText);
          return res.status(resp.status).json({ error: `Ошибка Сбер API: ${errText}` });
        }
        const data = await resp.json();
        const ops = data.operations || [];
        statements = ops.map(op => ({
          date: (op.operationDate || '').split('T')[0],
          amount: parseFloat(op.amount?.amount || op.amount || 0),
          description: op.paymentPurpose || op.description || '',
          counterparty: op.contragentName || '',
          type: parseFloat(op.amount?.amount || op.amount || 0) > 0 ? 'income' : 'expense'
        }));
      } catch (fetchErr) {
        return res.status(502).json({ error: `Ошибка подключения к Сбер: ${fetchErr.message}` });
      }
    } else {
      return res.status(400).json({ error: `Неизвестный тип банка: ${account.bank_type}` });
    }

    res.json({ accountName: account.name, bankType: account.bank_type, statements });
  } catch (err) {
    console.error('Bank statement error:', err);
    res.status(500).json({ error: 'Ошибка получения банковской выписки' });
  }
});

router.get('/reconciliation/bank-accounts', async (req, res) => {
  try {
    const { accountId } = req.query;
    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    const accRes = await db.query('SELECT id, bank_api_key, bank_type FROM accounts WHERE id = $1', [accountId]);
    if (accRes.rows.length === 0) return res.status(404).json({ error: 'Счёт не найден' });
    const account = accRes.rows[0];

    if (!account.bank_api_key || !account.bank_type) {
      return res.status(400).json({ error: 'Банковская интеграция не настроена' });
    }

    if (account.bank_type === 'tbank') {
      try {
        const resp = await fetch('https://business.tbank.ru/openapi/api/v1/bank-accounts', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${account.bank_api_key}`,
            'Accept': 'application/json'
          }
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error('T-Bank accounts error:', resp.status, errText);
          return res.status(resp.status).json({ error: `Ошибка Т-Банк API: ${errText}` });
        }
        const data = await resp.json();
        const accounts = (data || []).map(a => ({
          accountNumber: a.accountNumber,
          name: a.name || a.accountNumber,
          currency: a.currency,
          balance: a.balance?.otb ?? a.balance?.authorized ?? null
        }));
        return res.json(accounts);
      } catch (fetchErr) {
        return res.status(502).json({ error: `Ошибка подключения к Т-Банк: ${fetchErr.message}` });
      }
    }

    return res.json([]);
  } catch (err) {
    console.error('Bank accounts error:', err);
    res.status(500).json({ error: 'Ошибка получения списка счетов' });
  }
});

module.exports = router;
