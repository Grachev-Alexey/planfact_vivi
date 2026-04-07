const express = require('express');
const router = express.Router();
const db = require('../db.cjs');

router.get('/income-plan', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: 'year and month required' });
    const result = await db.query(
      'SELECT day, amount FROM income_daily_plan WHERE year = $1 AND month = $2',
      [parseInt(year), parseInt(month)]
    );
    const map = {};
    result.rows.forEach(r => { map[r.day] = parseFloat(r.amount); });
    res.json(map);
  } catch (err) {
    console.error('Error fetching income plan:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/income-plan', async (req, res) => {
  try {
    const { year, month, day, amount } = req.body;
    if (!year || !month || !day) return res.status(400).json({ error: 'year, month, day required' });
    const amt = parseFloat(amount) || 0;
    await db.query(
      `INSERT INTO income_daily_plan (year, month, day, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (year, month, day) DO UPDATE SET amount = EXCLUDED.amount`,
      [parseInt(year), parseInt(month), parseInt(day), amt]
    );
    res.json({ success: true, day, amount: amt });
  } catch (err) {
    console.error('Error saving income plan:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
