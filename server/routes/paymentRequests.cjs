const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');

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
        co.name as contractor_name
      FROM payment_requests pr
      LEFT JOIN users u ON pr.user_id = u.id
      LEFT JOIN categories c ON pr.category_id = c.id
      LEFT JOIN studios s ON pr.studio_id = s.id
      LEFT JOIN contractors co ON pr.contractor_id = co.id
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
    const { userId, amount, categoryId, studioId, contractorId, description } = req.body;

    const result = await db.query(
      `INSERT INTO payment_requests (user_id, amount, category_id, studio_id, contractor_id, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, amount, categoryId || null, studioId || null, contractorId || null, description || '']
    );

    const request = toCamelCase(result.rows[0]);

    const userRes = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
    const username = userRes.rows[0]?.username || '';
    const catRes = categoryId ? await db.query('SELECT name FROM categories WHERE id = $1', [categoryId]) : { rows: [] };
    const studioRes = studioId ? await db.query('SELECT name FROM studios WHERE id = $1', [studioId]) : { rows: [] };
    const contrRes = contractorId ? await db.query('SELECT name FROM contractors WHERE id = $1', [contractorId]) : { rows: [] };

    const webhookPayload = {
      event: 'payment_request_created',
      id: request.id,
      username,
      amount: parseFloat(amount),
      category: catRes.rows[0]?.name || null,
      studio: studioRes.rows[0]?.name || null,
      contractor: contrRes.rows[0]?.name || null,
      description: description || '',
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

router.put('/payment-requests/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const paidAt = status === 'paid' ? 'NOW()' : 'NULL';

    const result = await db.query(
      `UPDATE payment_requests SET status = $1, paid_at = ${paidAt}, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
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
        id: request.id,
        username: full?.username || '',
        amount: parseFloat(full?.amount || 0),
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
