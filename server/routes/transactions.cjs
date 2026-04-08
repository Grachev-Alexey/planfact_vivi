const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');
const crypto = require('crypto');

let _hasExternalId = null;
async function hasExternalIdColumn() {
  if (_hasExternalId !== null) return _hasExternalId;
  const res = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='external_id'`);
  _hasExternalId = res.rows.length > 0;
  return _hasExternalId;
}

function buildInsertQuery(extraCols, extraVals, baseCols, baseVals) {
  const cols = [...baseCols, ...extraCols];
  const vals = [...baseVals, ...extraVals];
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  return { sql: `INSERT INTO transactions (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`, vals };
}

router.post('/transactions/bulk-import', async (req, res) => {
  const { rows } = req.body;
  const currentUserId = req.headers['x-user-id'];

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided' });
  }

  const results = { imported: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const { date, amount, type, accountId, toAccountId, categoryId, studioId, description, contractorId, confirmed, accrualDate } = row;
      if (!date || !amount || !type || !accountId) {
        results.errors.push({ row: i + 1, error: 'Не заполнены обязательные поля (дата, сумма, тип, счет)' });
        continue;
      }
      if (!['income', 'expense', 'transfer'].includes(type)) {
        results.errors.push({ row: i + 1, error: `Неизвестный тип: ${type}` });
        continue;
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        results.errors.push({ row: i + 1, error: 'Сумма должна быть положительным числом' });
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        results.errors.push({ row: i + 1, error: 'Некорректный формат даты' });
        continue;
      }
      if (type === 'transfer' && !toAccountId) {
        results.errors.push({ row: i + 1, error: 'Для перемещения нужно указать счет назначения' });
        continue;
      }
      if (type === 'transfer' && toAccountId === accountId) {
        results.errors.push({ row: i + 1, error: 'Счет и счет назначения совпадают' });
        continue;
      }
      if (type !== 'transfer' && !categoryId) {
        results.errors.push({ row: i + 1, error: 'Не указана статья' });
        continue;
      }
      const accCheck = await db.query('SELECT id FROM accounts WHERE id=$1', [accountId]);
      if (accCheck.rows.length === 0) {
        results.errors.push({ row: i + 1, error: 'Счет не найден в базе' });
        continue;
      }

      const bCols = ['date', 'amount', 'type', 'account_id', 'to_account_id', 'category_id', 'studio_id', 'description', 'contractor_id', 'confirmed', 'accrual_date'];
      const bVals = [date, parsedAmount, type, accountId, toAccountId || null, categoryId || null, studioId || null, description || '', contractorId || null, confirmed || false, accrualDate || null];
      const eCols = [];
      const eVals = [];
      if (await hasExternalIdColumn()) {
        eCols.push('external_id');
        eVals.push(crypto.randomUUID());
      }
      const { sql: bQuery, vals: bValues } = buildInsertQuery(eCols, eVals, bCols, bVals);
      await db.query(bQuery, bValues);
      results.imported++;
    } catch (err) {
      results.errors.push({ row: i + 1, error: err.message });
    }
  }

  if (results.imported > 0) {
    const word = results.imported === 1 ? 'операция' : results.imported < 5 ? 'операции' : 'операций';
    await logAction(currentUserId, 'create', 'transaction', null, `Импортировано ${results.imported} ${word} из файла`);
  }

  res.json(results);
});

// Create Transaction
router.post('/transactions', async (req, res) => {
  const { date, amount, type, accountId, categoryId, studioId, description, toAccountId, contractorId, confirmed, accrualDate, status } = req.body;
  const currentUserId = req.headers['x-user-id'];
  
  try {
    // Status drives confirmed for expense; otherwise use legacy confirmed flag
    const finalStatus = status !== undefined ? (status || null) : (type === 'transfer' ? null : null);
    const finalConfirmed = status !== undefined ? (status === 'verified') : (type === 'transfer' ? true : (confirmed || false));

    const baseCols = ['date', 'amount', 'type', 'account_id', 'category_id', 'studio_id', 'description', 'to_account_id', 'contractor_id', 'confirmed', 'accrual_date', 'status'];
    const baseVals = [date, amount, type, accountId, categoryId || null, studioId || null, description || '', toAccountId || null, contractorId || null, finalConfirmed, accrualDate || null, finalStatus];

    const extraCols = [];
    const extraVals = [];
    if (await hasExternalIdColumn()) {
      extraCols.push('external_id');
      extraVals.push(crypto.randomUUID());
    }
    const { sql: query, vals: values } = buildInsertQuery(extraCols, extraVals, baseCols, baseVals);

    const result = await db.query(query, values);
    const newTx = result.rows[0];

    const typeLabels = { income: 'поступление', expense: 'выплата', transfer: 'перемещение' };
    const parts = [`${typeLabels[type] || type}, ${amount}₽`];
    if (date) parts.push(`дата: ${date}`);
    const [accName, catName, stdName, contrName, toAccName] = await Promise.all([
      accountId ? db.query('SELECT name FROM accounts WHERE id=$1', [accountId]).then(r => r.rows[0]?.name) : null,
      categoryId ? db.query('SELECT name FROM categories WHERE id=$1', [categoryId]).then(r => r.rows[0]?.name) : null,
      studioId ? db.query('SELECT name FROM studios WHERE id=$1', [studioId]).then(r => r.rows[0]?.name) : null,
      contractorId ? db.query('SELECT name FROM contractors WHERE id=$1', [contractorId]).then(r => r.rows[0]?.name) : null,
      toAccountId ? db.query('SELECT name FROM accounts WHERE id=$1', [toAccountId]).then(r => r.rows[0]?.name) : null,
    ]);
    if (accName) parts.push(`счет: ${accName}`);
    if (toAccName) parts.push(`→ ${toAccName}`);
    if (catName) parts.push(`статья: ${catName}`);
    if (stdName) parts.push(`студия: ${stdName}`);
    if (contrName) parts.push(`контрагент: ${contrName}`);
    if (description) parts.push(`"${description}"`);

    await logAction(currentUserId, 'create', 'transaction', newTx.id, `Создана операция: ${parts.join(', ')}`);
    res.json(toCamelCase(newTx));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating transaction' });
  }
});

// Update Transaction
router.put('/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const { date, amount, type, accountId, categoryId, studioId, description, toAccountId, contractorId, confirmed, accrualDate, status } = req.body;
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

    const finalDate = date !== undefined ? date : old.date;
    const finalAmount = amount !== undefined ? amount : old.amount;
    const finalType = type !== undefined ? type : old.type;
    const finalAccountId = accountId !== undefined ? accountId : old.account_id;
    const finalCategoryId = categoryId !== undefined ? (categoryId || null) : old.category_id;
    const finalStudioId = studioId !== undefined ? (studioId || null) : old.studio_id;
    const finalDescription = description !== undefined ? (description || '') : (old.description || '');
    const finalToAccountId = toAccountId !== undefined ? (toAccountId || null) : old.to_account_id;
    const finalContractorId = contractorId !== undefined ? (contractorId || null) : old.contractor_id;
    const finalAcrcualDate = accrualDate !== undefined ? (accrualDate || null) : old.accrual_date;

    let finalStatus = status !== undefined ? (status || null) : (old.status || null);
    let finalConfirmed;
    if (status !== undefined) {
      finalConfirmed = status === 'verified';
      finalStatus = status || null;
    } else {
      finalConfirmed = confirmed !== undefined ? (confirmed || false) : (old.confirmed || false);
      if (finalConfirmed && !finalStatus) finalStatus = 'verified';
    }

    const query = `
      UPDATE transactions 
      SET date=$1, amount=$2, type=$3, account_id=$4, category_id=$5, studio_id=$6, description=$7, to_account_id=$8, contractor_id=$9, confirmed=$10, accrual_date=$11, status=$12, updated_at=NOW()
      WHERE id = $13 RETURNING *
    `;
    const values = [finalDate, finalAmount, finalType, finalAccountId, finalCategoryId, finalStudioId, finalDescription, finalToAccountId, finalContractorId, finalConfirmed, finalAcrcualDate, finalStatus, id];

    const result = await db.query(query, values);

    // Sync update back to master_incomes if this is a master income (external_id='mi-{id}')
    if (old.external_id && old.external_id.startsWith('mi-')) {
      const masterIncomeId = old.external_id.substring(3);
      await db.query(
        `UPDATE master_incomes SET amount=$1, category_id=$2, account_id=$3 WHERE id=$4`,
        [amount, categoryId || null, accountId, masterIncomeId]
      );
    }

    // Sync changes back to payment_request if this is a PR-linked transaction
    if (old.external_id && old.external_id.startsWith('pr-')) {
      const prId = old.external_id.substring(3);
      const prUpdates = [];
      const prParams = [];
      let prIdx = 1;

      if (finalStatus !== undefined) {
        const prStatusMap = { pending: 'pending', approved: 'approved', paid: 'paid', verified: 'verified' };
        prUpdates.push(`status = $${prIdx++}`);
        prParams.push(prStatusMap[finalStatus] || 'pending');
      }
      if (finalAmount !== undefined && Number(finalAmount) !== Number(old.amount)) {
        prUpdates.push(`amount = $${prIdx++}`);
        prParams.push(finalAmount);
      }
      if (finalDate && finalDate !== (old.date instanceof Date ? old.date.toISOString().split('T')[0] : String(old.date || '').split('T')[0])) {
        prUpdates.push(`payment_date = $${prIdx++}`);
        prParams.push(finalDate);
      }
      if (finalDescription !== undefined && finalDescription !== (old.description || '')) {
        prUpdates.push(`description = $${prIdx++}`);
        prParams.push(finalDescription);
      }
      if (finalCategoryId !== undefined && String(finalCategoryId || '') !== String(old.category_id || '')) {
        prUpdates.push(`category_id = $${prIdx++}`);
        prParams.push(finalCategoryId || null);
      }
      if (finalStudioId !== undefined && String(finalStudioId || '') !== String(old.studio_id || '')) {
        prUpdates.push(`studio_id = $${prIdx++}`);
        prParams.push(finalStudioId || null);
      }
      if (finalContractorId !== undefined && String(finalContractorId || '') !== String(old.contractor_id || '')) {
        prUpdates.push(`contractor_id = $${prIdx++}`);
        prParams.push(finalContractorId || null);
      }
      if (finalAccountId !== undefined && String(finalAccountId || '') !== String(old.account_id || '')) {
        prUpdates.push(`account_id = $${prIdx++}`);
        prParams.push(finalAccountId || null);
      }
      const finalAcrcualDateStr = finalAcrcualDate || null;
      const oldAcrcualDateStr = old.accrual_date instanceof Date ? old.accrual_date.toISOString().split('T')[0] : (old.accrual_date || null);
      if (finalAcrcualDateStr !== oldAcrcualDateStr) {
        prUpdates.push(`accrual_date = $${prIdx++}`);
        prParams.push(finalAcrcualDateStr);
      }

      if (prUpdates.length > 0) {
        prUpdates.push('updated_at = NOW()');
        prParams.push(prId);
        await db.query(
          `UPDATE payment_requests SET ${prUpdates.join(', ')} WHERE id = $${prIdx}`,
          prParams
        );
      }
    }

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
    const oldRes = await db.query(`
      SELECT t.*, a.name as account_name, c.name as category_name, 
        s.name as studio_name, co.name as contractor_name, ta.name as to_account_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN accounts ta ON t.to_account_id = ta.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN studios s ON t.studio_id = s.id
      LEFT JOIN contractors co ON t.contractor_id = co.id
      WHERE t.id = $1
    `, [req.params.id]);

    if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const old = oldRes.rows[0];

    // Also delete related records if this is linked to something
    if (old.external_id) {
      if (old.external_id.startsWith('mi-')) {
        // Delete from master_incomes if this is a master income
        const masterIncomeId = old.external_id.substring(3);
        await db.query('DELETE FROM master_incomes WHERE id = $1', [masterIncomeId]);
      } else if (old.external_id.startsWith('pr-')) {
        // Delete from payment_requests if this is a payment request
        const paymentRequestId = old.external_id.substring(3);
        await db.query('DELETE FROM payment_requests WHERE id = $1', [paymentRequestId]);
      }
    }

    await db.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);

    const typeLabels = { income: 'поступление', expense: 'выплата', transfer: 'перемещение' };
    let detail = 'Удалена операция';
    if (oldRes.rows.length > 0) {
      const old = oldRes.rows[0];
      const parts = [`${typeLabels[old.type] || old.type}, ${Number(old.amount)}₽`];
      if (old.account_name) parts.push(`счет: ${old.account_name}`);
      if (old.to_account_name) parts.push(`→ ${old.to_account_name}`);
      if (old.category_name) parts.push(`статья: ${old.category_name}`);
      if (old.studio_name) parts.push(`студия: ${old.studio_name}`);
      if (old.contractor_name) parts.push(`контрагент: ${old.contractor_name}`);
      detail = `Удалена операция: ${parts.join(', ')}`;
    }

    await logAction(currentUserId, 'delete', 'transaction', req.params.id, detail);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting transaction' });
  }
});

// Batch status update
router.put('/transactions-batch/status', async (req, res) => {
  const { ids, status, confirmed } = req.body;
  const currentUserId = req.headers['x-user-id'];
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids required' });
  }
  try {
    const finalConfirmed = status === 'verified' ? true : (confirmed !== undefined ? confirmed : false);
    if (status !== undefined) {
      const finalStatus = status || null;
      await db.query(
        `UPDATE transactions SET status=$1, confirmed=$2, updated_at=NOW() WHERE id = ANY($3::int[])`,
        [finalStatus, finalConfirmed, ids]
      );
    } else {
      await db.query(
        `UPDATE transactions SET confirmed=$1, updated_at=NOW() WHERE id = ANY($2::int[])`,
        [finalConfirmed, ids]
      );
    }
    // Sync PR-linked transactions
    const prLinked = await db.query(
      `SELECT id, external_id FROM transactions WHERE id = ANY($1::int[]) AND external_id LIKE 'pr-%'`,
      [ids]
    );
    for (const row of prLinked.rows) {
      const prId = row.external_id.substring(3);
      const prStatusMap = { pending: 'pending', approved: 'approved', paid: 'paid', verified: 'paid' };
      await db.query(
        `UPDATE payment_requests SET status=$1, updated_at=NOW() WHERE id=$2`,
        [prStatusMap[status] || 'pending', prId]
      );
    }
    await logAction(currentUserId, 'batch_update', 'transaction', null, `Массовое обновление статуса → ${status} (${ids.length} шт.)`);
    res.json({ success: true, count: ids.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Batch status update failed' });
  }
});

// Batch delete
router.post('/transactions-batch/delete', async (req, res) => {
  const { ids } = req.body;
  const currentUserId = req.headers['x-user-id'];
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids required' });
  }
  try {
    // Clean up linked records
    const linked = await db.query(
      `SELECT id, external_id FROM transactions WHERE id = ANY($1::int[])`,
      [ids]
    );
    for (const row of linked.rows) {
      if (row.external_id?.startsWith('mi-')) {
        await db.query('DELETE FROM master_incomes WHERE id = $1', [row.external_id.substring(3)]);
      } else if (row.external_id?.startsWith('pr-')) {
        await db.query('DELETE FROM payment_requests WHERE id = $1', [row.external_id.substring(3)]);
      }
    }
    const result = await db.query('DELETE FROM transactions WHERE id = ANY($1::int[])', [ids]);
    await logAction(currentUserId, 'batch_delete', 'transaction', null, `Массовое удаление (${result.rowCount} шт.)`);
    res.json({ success: true, count: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Batch delete failed' });
  }
});

module.exports = router;