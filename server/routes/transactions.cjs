const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

// Create Transaction
router.post('/transactions', async (req, res) => {
  const { date, amount, type, accountId, categoryId, studioId, description, toAccountId, contractorId } = req.body;
  const currentUserId = req.headers['x-user-id'];
  
  try {
    const query = `
      INSERT INTO transactions (date, amount, type, account_id, category_id, studio_id, description, to_account_id, contractor_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `;
    const values = [date, amount, type, accountId, categoryId || null, studioId || null, description || '', toAccountId || null, contractorId || null];

    const result = await db.query(query, values);
    const newTx = result.rows[0];
    
    await logAction(currentUserId, 'create', 'transaction', newTx.id, { type, amount });
    res.json(toCamelCase(newTx));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating transaction' });
  }
});

// Update Transaction
router.put('/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const { date, amount, type, accountId, categoryId, studioId, description, toAccountId, contractorId } = req.body;
  const currentUserId = req.headers['x-user-id'];

  try {
    const oldRes = await db.query(`
      SELECT t.*, 
        a.name as account_name, ta.name as to_account_name,
        c.name as category_name, s.name as studio_name, co.name as contractor_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN studios s ON t.studio_id = s.id
      LEFT JOIN contractors co ON t.contractor_id = co.id
      WHERE t.id = $1
    `, [id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const old = oldRes.rows[0];

    const query = `
      UPDATE transactions 
      SET date=$1, amount=$2, type=$3, account_id=$4, category_id=$5, studio_id=$6, description=$7, to_account_id=$8, contractor_id=$9, updated_at=NOW()
      WHERE id = $10 RETURNING *
    `;
    const values = [date, amount, type, accountId, categoryId || null, studioId || null, description || '', toAccountId || null, contractorId || null, id];

    const result = await db.query(query, values);

    const newAccountName = accountId ? (await db.query('SELECT name FROM accounts WHERE id=$1', [accountId])).rows[0]?.name : null;
    const newCategoryName = categoryId ? (await db.query('SELECT name FROM categories WHERE id=$1', [categoryId])).rows[0]?.name : null;
    const newStudioName = studioId ? (await db.query('SELECT name FROM studios WHERE id=$1', [studioId])).rows[0]?.name : null;
    const newContractorName = contractorId ? (await db.query('SELECT name FROM contractors WHERE id=$1', [contractorId])).rows[0]?.name : null;
    const newToAccountName = toAccountId ? (await db.query('SELECT name FROM accounts WHERE id=$1', [toAccountId])).rows[0]?.name : null;

    const typeLabels = { income: 'поступление', expense: 'выплата', transfer: 'перемещение' };
    const changes = [];
    if (old.type !== type) changes.push(`тип: ${typeLabels[old.type] || old.type} → ${typeLabels[type] || type}`);
    if (Number(old.amount) !== Number(amount)) changes.push(`сумма: ${Number(old.amount)} → ${amount}`);
    const oldDate = old.date instanceof Date ? old.date.toISOString().split('T')[0] : String(old.date || '').split('T')[0];
    if (oldDate !== date) changes.push(`дата: ${oldDate} → ${date}`);
    if (String(old.account_id) !== String(accountId)) changes.push(`счет: ${old.account_name || '-'} → ${newAccountName || '-'}`);
    if (String(old.category_id || '') !== String(categoryId || '')) changes.push(`статья: ${old.category_name || '-'} → ${newCategoryName || '-'}`);
    if (String(old.studio_id || '') !== String(studioId || '')) changes.push(`студия: ${old.studio_name || '-'} → ${newStudioName || '-'}`);
    if (String(old.contractor_id || '') !== String(contractorId || '')) changes.push(`контрагент: ${old.contractor_name || '-'} → ${newContractorName || '-'}`);
    if ((old.description || '') !== (description || '')) changes.push(`описание: "${old.description || ''}" → "${description || ''}"`);
    if (String(old.to_account_id || '') !== String(toAccountId || '')) changes.push(`счет назначения: ${old.to_account_name || '-'} → ${newToAccountName || '-'}`);

    const detail = changes.length > 0
      ? `Изменена операция (${typeLabels[type] || type}, ${amount}₽). Изменения: ${changes.join('; ')}`
      : `Изменена операция (${typeLabels[type] || type}, ${amount}₽)`;

    await logAction(currentUserId, 'update', 'transaction', id, detail);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating transaction' });
  }
});

// Delete Transaction
router.delete('/transactions/:id', async (req, res) => {
  const currentUserId = req.headers['x-user-id'];
  try {
    await db.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    await logAction(currentUserId, 'delete', 'transaction', req.params.id, 'Удалена операция');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting transaction' });
  }
});

module.exports = router;