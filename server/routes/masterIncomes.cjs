const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

let _hasExternalId = null;
async function hasExternalIdColumn() {
  if (_hasExternalId !== null) return _hasExternalId;
  const res = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='external_id'`);
  _hasExternalId = res.rows.length > 0;
  return _hasExternalId;
}

async function requireMaster(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const userRes = await db.query('SELECT id, role, studio_id FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) { res.status(401).json({ error: 'User not found' }); return null; }
  const user = userRes.rows[0];
  if (user.role !== 'master') { res.status(403).json({ error: 'Forbidden: master role required' }); return null; }
  return user;
}

router.get('/master-incomes', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;

  try {
    const result = await db.query(
      `SELECT mi.*, c.name as category_name, s.name as studio_name
       FROM master_incomes mi
       LEFT JOIN categories c ON mi.category_id = c.id
       LEFT JOIN studios s ON mi.studio_id = s.id
       WHERE mi.user_id = $1
       ORDER BY mi.created_at DESC
       LIMIT 100`,
      [master.id]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching master incomes:', err);
    res.status(500).json({ error: 'Error fetching master incomes' });
  }
});

router.post('/master-incomes', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;

  const { amount, paymentType, categoryId, clientName, clientPhone, description } = req.body;

  if (!amount || !paymentType) {
    return res.status(400).json({ error: 'amount and paymentType required' });
  }

  const studioId = master.studio_id;

  try {
    const result = await db.query(
      `INSERT INTO master_incomes (user_id, studio_id, amount, payment_type, category_id, client_name, client_phone, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [master.id, studioId, amount, paymentType, categoryId || null, clientName || '', clientPhone || '', description || '']
    );

    const mi = result.rows[0];

    const useExtId = await hasExternalIdColumn();
    const extCols = useExtId ? ['external_id'] : [];
    const extVals = useExtId ? [`mi-${mi.id}`] : [];

    const baseCols = ['date', 'amount', 'type', 'studio_id', 'category_id', 'description', 'confirmed'];
    const baseVals = [new Date().toISOString().split('T')[0], amount, 'income', studioId, categoryId || null,
      `${paymentType}${clientName ? ' | ' + clientName : ''}${clientPhone ? ' | ' + clientPhone : ''}${description ? ' | ' + description : ''}`, false];

    const allCols = [...baseCols, ...extCols];
    const allVals = [...baseVals, ...extVals];
    const placeholders = allVals.map((_, i) => `$${i + 1}`).join(', ');

    await db.query(
      `INSERT INTO transactions (${allCols.join(', ')}) VALUES (${placeholders})`,
      allVals
    );

    await logAction(master.id, 'create', 'master_income', mi.id, {
      amount: parseFloat(amount),
      paymentType,
      clientName: clientName || '',
    });

    res.json(toCamelCase(mi));
  } catch (err) {
    console.error('Error creating master income:', err);
    res.status(500).json({ error: 'Error creating master income' });
  }
});

module.exports = router;
