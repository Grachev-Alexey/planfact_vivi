const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { verifyTransaction, verifyBatch, getVisitsByPhone, updateClientInfo } = require('../services/yclients.cjs');

router.get('/yclients/search-by-phone', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRes = await db.query('SELECT id, role, studio_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'master') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = userRes.rows[0];
    const { phone } = req.query;

    if (!user.studio_id) return res.json({ visits: [], noStudio: true });

    const studioRes = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [user.studio_id]);
    if (studioRes.rows.length === 0 || !studioRes.rows[0].yclients_id) {
      return res.json({ visits: [], noYclients: true });
    }

    const companyId = studioRes.rows[0].yclients_id;
    const today = new Date().toISOString().split('T')[0];

    const visits = await getVisitsByPhone(companyId, today, phone);
    res.json({ visits });
  } catch (err) {
    console.error('YClients search by phone error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/yclients/update-client', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRes = await db.query('SELECT role, studio_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'master') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { studio_id } = userRes.rows[0];
    const { clientId, surname, name } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const studioRes = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [studio_id]);
    if (studioRes.rows.length === 0 || !studioRes.rows[0].yclients_id) {
      return res.status(400).json({ error: 'Studio not linked to YClients' });
    }
    const companyId = studioRes.rows[0].yclients_id;

    const fields = {};
    if (surname !== undefined) fields.surname = surname;
    if (name !== undefined) fields.name = name;

    const result = await updateClientInfo(companyId, clientId, fields);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('YClients update client error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/yclients/verify/:id', async (req, res) => {
  try {
    const result = await verifyTransaction(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    console.error('YClients verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/yclients/verify-batch', async (req, res) => {
  const { studioId, dateFrom, dateTo } = req.body;
  if (!studioId || !dateFrom || !dateTo) {
    return res.status(400).json({ error: 'studioId, dateFrom, dateTo required' });
  }
  try {
    const result = await verifyBatch(studioId, dateFrom, dateTo);
    res.json(result);
  } catch (err) {
    console.error('YClients batch verify error:', err);
    res.status(500).json({ error: 'Batch verification failed' });
  }
});

module.exports = router;
