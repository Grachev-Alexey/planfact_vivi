const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

// Create Transaction
router.post('/transactions', async (req, res) => {
  const { date, amount, type, accountId, categoryId, studioId, description, toAccountId, contractorId, projectId } = req.body;
  const currentUserId = req.headers['x-user-id'];
  
  try {
    const query = `
      INSERT INTO transactions (date, amount, type, account_id, category_id, studio_id, description, to_account_id, contractor_id, project_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `;
    const values = [date, amount, type, accountId, categoryId || null, studioId || null, description || '', toAccountId || null, contractorId || null, projectId || null];

    const result = await db.query(query, values);
    const newTx = result.rows[0];
    
    await logAction(currentUserId, 'create', 'transaction', newTx.id, `Created ${type} ${amount}`);
    res.json(toCamelCase(newTx));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating transaction' });
  }
});

// Update Transaction
router.put('/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const { date, amount, type, accountId, categoryId, studioId, description, toAccountId, contractorId, projectId } = req.body;
  const currentUserId = req.headers['x-user-id'];

  try {
    const query = `
      UPDATE transactions 
      SET date=$1, amount=$2, type=$3, account_id=$4, category_id=$5, studio_id=$6, description=$7, to_account_id=$8, contractor_id=$9, project_id=$10, updated_at=NOW()
      WHERE id = $11 RETURNING *
    `;
    const values = [date, amount, type, accountId, categoryId || null, studioId || null, description || '', toAccountId || null, contractorId || null, projectId || null, id];

    const result = await db.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    await logAction(currentUserId, 'update', 'transaction', id, `Updated transaction amount: ${amount}`);
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Error updating transaction' });
  }
});

// Delete Transaction
router.delete('/transactions/:id', async (req, res) => {
  const currentUserId = req.headers['x-user-id'];
  try {
    await db.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    await logAction(currentUserId, 'delete', 'transaction', req.params.id, 'Deleted transaction');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting transaction' });
  }
});

module.exports = router;