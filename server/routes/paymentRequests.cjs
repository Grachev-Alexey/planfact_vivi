const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

router.get('/payment-requests', async (req, res) => {
  try {
    const { userId, status } = req.query;
    let where = [];
    let params = [];
    let idx = 1;

    if (userId) {
      where.push(`pr.user_id = $${idx++}`);
      params.push(userId);
    }
    if (status) {
      where.push(`pr.status = $${idx++}`);
      params.push(status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT pr.*, u.username,
        c.name as category_name, c.type as category_type,
        s.name as studio_name,
        co.name as contractor_name,
        a.name as account_name
      FROM payment_requests pr
      LEFT JOIN users u ON pr.user_id = u.id
      LEFT JOIN categories c ON pr.category_id = c.id
      LEFT JOIN studios s ON pr.studio_id = s.id
      LEFT JOIN contractors co ON pr.contractor_id = co.id
      LEFT JOIN accounts a ON pr.account_id = a.id
      ${whereClause}
      ORDER BY pr.created_at DESC
    `, params);

    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching payment requests:', err);
    res.status(500).json({ error: 'Error fetching payment requests' });
  }
});

router.post('/payment-requests', async (req, res) => {
  try {
    const { userId, amount, categoryId, studioId, contractorId, accountId, description, paymentDate, accrualDate } = req.body;

    if (!userId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'userId and positive amount are required' });
    }
    if (!accountId) {
      return res.status(400).json({ error: 'accountId is required' });
    }

    const result = await db.query(
      `INSERT INTO payment_requests (user_id, amount, category_id, studio_id, contractor_id, account_id, description, payment_date, accrual_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, amount, categoryId || null, studioId || null, contractorId || null, accountId, description || '', paymentDate || null, accrualDate || null]
    );

    const pr = result.rows[0];
    const request = toCamelCase(pr);

    const txDate = pr.payment_date || new Date().toISOString().split('T')[0];
    const txAccrualDate = pr.accrual_date || null;
    const txAccountId = pr.account_id;

    if (txAccountId) {
      const externalId = `pr-${pr.id}`;
      const txResult = await db.query(
        `INSERT INTO transactions (date, amount, type, account_id, category_id, studio_id, contractor_id, description, confirmed, accrual_date, external_id)
         VALUES ($1, $2, 'expense', $3, $4, $5, $6, $7, false, $8, $9) RETURNING *`,
        [txDate, pr.amount, txAccountId, pr.category_id || null, pr.studio_id || null, pr.contractor_id || null, pr.description || '', txAccrualDate, externalId]
      );

      if (userId) {
        await logAction(userId, 'create', 'transaction', txResult.rows[0].id, {
          amount: parseFloat(pr.amount),
          type: 'expense',
          description: `Запрос на выплату #${pr.id}: ${pr.description || ''}`.trim()
        });
      }
    }

    const userRes = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = userRes.rows[0]?.username || '';
    const catRes = categoryId ? await db.query('SELECT name FROM categories WHERE id = $1', [categoryId]) : { rows: [] };
    const studioRes = studioId ? await db.query('SELECT name FROM studios WHERE id = $1', [studioId]) : { rows: [] };
    const contrRes = contractorId ? await db.query('SELECT name FROM contractors WHERE id = $1', [contractorId]) : { rows: [] };

    const webhookPayload = {
      event: 'payment_request_created',
      action: 'create',
      id: request.id,
      username,
      amount: parseFloat(amount),
      category: catRes.rows[0]?.name || null,
      studio: studioRes.rows[0]?.name || null,
      contractor: contrRes.rows[0]?.name || null,
      description: description || '',
      paymentDate: paymentDate || null,
      accrualDate: accrualDate || null,
      createdAt: request.createdAt
    };

    fetch('https://vivi-stats.store/webhook/planfact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    }).catch(err => console.error('Webhook error:', err));

    res.json(request);
  } catch (err) {
    console.error('Error creating payment request:', err);
    res.status(500).json({ error: 'Error creating payment request' });
  }
});

router.put('/payment-requests/:id/telegram', async (req, res) => {
  try {
    const { telegramMessageId } = req.body;
    const result = await db.query(
      `UPDATE payment_requests SET telegram_message_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [telegramMessageId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (err) {
    console.error('Error updating telegram message id:', err);
    res.status(500).json({ error: 'Error updating telegram message id' });
  }
});

router.put('/payment-requests/:id', async (req, res) => {
  try {
    const { status, accountId, paidAmount, paidDate, paidComment } = req.body;

    if (status === 'paid') {
      if (!accountId) return res.status(400).json({ error: 'accountId is required for payment' });
      if (!paidAmount || parseFloat(paidAmount) <= 0) return res.status(400).json({ error: 'paidAmount is required for payment' });
      if (!paidDate) return res.status(400).json({ error: 'paidDate is required for payment' });
    }

    let updateFields = ['status = $1', 'updated_at = NOW()'];
    let params = [status];
    let idx = 2;

    if (status === 'paid') {
      updateFields.push(`paid_at = NOW()`);
      if (paidAmount !== undefined) {
        updateFields.push(`paid_amount = $${idx++}`);
        params.push(paidAmount);
      }
      if (paidDate) {
        updateFields.push(`paid_date = $${idx++}`);
        params.push(paidDate);
      }
      if (paidComment !== undefined) {
        updateFields.push(`paid_comment = $${idx++}`);
        params.push(paidComment);
      }
      if (accountId) {
        updateFields.push(`account_id = $${idx++}`);
        params.push(accountId);
      }
    }

    params.push(req.params.id);
    const result = await db.query(
      `UPDATE payment_requests SET ${updateFields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = toCamelCase(result.rows[0]);

    if (status === 'paid' || status === 'rejected') {
      const fullRes = await db.query(`
        SELECT pr.*, u.username, c.name as category_name, s.name as studio_name, co.name as contractor_name
        FROM payment_requests pr
        LEFT JOIN users u ON pr.user_id = u.id
        LEFT JOIN categories c ON pr.category_id = c.id
        LEFT JOIN studios s ON pr.studio_id = s.id
        LEFT JOIN contractors co ON pr.contractor_id = co.id
        WHERE pr.id = $1
      `, [req.params.id]);

      const full = fullRes.rows[0];
      const webhookPayload = {
        event: `payment_request_${status}`,
        action: status,
        id: request.id,
        telegramMessageId: full?.telegram_message_id || null,
        username: full?.username || '',
        amount: parseFloat(full?.amount || 0),
        paidAmount: full?.paid_amount ? parseFloat(full.paid_amount) : null,
        paidDate: full?.paid_date || null,
        paidComment: full?.paid_comment || '',
        category: full?.category_name || null,
        studio: full?.studio_name || null,
        contractor: full?.contractor_name || null,
        description: full?.description || '',
        status,
        paidAt: request.paidAt
      };

      fetch('https://vivi-stats.store/webhook/planfact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      }).catch(err => console.error('Webhook error:', err));
    }

    res.json(request);
  } catch (err) {
    console.error('Error updating payment request:', err);
    res.status(500).json({ error: 'Error updating payment request' });
  }
});

router.delete('/payment-requests/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM payment_requests WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting payment request:', err);
    res.status(500).json({ error: 'Error deleting payment request' });
  }
});

module.exports = router;
