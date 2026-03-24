const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { verifyTransaction, verifyBatch, getVisitsByPhone, updateClientInfo, getRecord, updateRecord, getClientDetails, updateClientCustomFields, getAvailableCustomFields } = require('../services/yclients.cjs');

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

const DEFAULT_FORM_CONFIG = { commentEnabled: false, commentEditable: false, fields: [] };

router.get('/yclients/form-settings', async (req, res) => {
  try {
    const r = await db.query("SELECT value FROM app_settings WHERE key = 'yclients_form_config'");
    const config = r.rows.length > 0 ? JSON.parse(r.rows[0].value) : DEFAULT_FORM_CONFIG;
    res.json(config);
  } catch (err) {
    if (err.code === '42P01') return res.json(DEFAULT_FORM_CONFIG);
    console.error('form-settings GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/yclients/form-settings', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const config = req.body;
    await db.query(
      "INSERT INTO app_settings (key, value) VALUES ('yclients_form_config', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [JSON.stringify(config)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('form-settings PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/yclients/record-details', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const userRes = await db.query('SELECT role, studio_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });
    const user = userRes.rows[0];
    if (!user.studio_id) return res.json({ error: 'No studio' });
    const studioRes = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [user.studio_id]);
    if (studioRes.rows.length === 0 || !studioRes.rows[0].yclients_id) return res.json({ error: 'No YClients' });
    const companyId = studioRes.rows[0].yclients_id;

    const { recordId, clientId } = req.query;
    const [record, client] = await Promise.all([
      recordId ? getRecord(companyId, recordId) : null,
      clientId ? getClientDetails(companyId, clientId) : null,
    ]);
    // YClients may return custom_fields as array or as object keyed by id — normalise to array
    const toArray = (fields) => {
      if (!fields) return [];
      if (Array.isArray(fields)) return fields;
      return Object.values(fields);
    };
    res.json({
      comment: record?.comment || '',
      recordCustomFields: toArray(record?.custom_fields),
      clientCustomFields: toArray(client?.custom_fields),
    });
  } catch (err) {
    console.error('record-details error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/yclients/available-fields', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const userRes = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const studioRes = await db.query('SELECT yclients_id FROM studios WHERE yclients_id IS NOT NULL LIMIT 1');
    if (studioRes.rows.length === 0) return res.json({ record: [], client: [] });
    const companyId = studioRes.rows[0].yclients_id;
    const fields = await getAvailableCustomFields(companyId);
    res.json(fields);
  } catch (err) {
    console.error('available-fields error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/yclients/update-record', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const userRes = await db.query('SELECT role, studio_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });
    const user = userRes.rows[0];
    if (!user.studio_id) return res.status(400).json({ error: 'No studio' });
    const studioRes = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [user.studio_id]);
    if (studioRes.rows.length === 0 || !studioRes.rows[0].yclients_id) return res.status(400).json({ error: 'No YClients' });
    const companyId = studioRes.rows[0].yclients_id;

    const { recordId, clientId, comment, recordCustomFields, clientCustomFields } = req.body;
    const results = {};

    if (recordId && (comment !== undefined || (recordCustomFields && recordCustomFields.length > 0))) {
      const payload = {};
      if (comment !== undefined) payload.comment = comment;
      if (recordCustomFields && recordCustomFields.length > 0) payload.custom_fields = recordCustomFields;
      results.record = await updateRecord(companyId, recordId, payload);
    }

    if (clientId && clientCustomFields && clientCustomFields.length > 0) {
      results.client = await updateClientCustomFields(companyId, clientId, clientCustomFields);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('update-record error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
