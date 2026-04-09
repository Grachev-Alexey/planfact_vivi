const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { verifyTransaction, verifyBatch, getVisitsByPhone, getTodaySchedule, updateClientInfo, getRecord, updateRecord, getClientDetails, updateClientCustomFields, getAvailableCustomFields, buildGlobalFieldCodeMap, checkClientAbonement } = require('../services/yclients.cjs');
const { getMoscowToday } = require('../utils/moscow.cjs');

router.get('/yclients/client-type', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const userRes = await db.query('SELECT id, role, studio_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'master') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { clientId } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const studioRes = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [userRes.rows[0].studio_id]);
    if (studioRes.rows.length === 0 || !studioRes.rows[0].yclients_id) {
      return res.json({ clientType: 'primary' });
    }
    const companyId = studioRes.rows[0].yclients_id;
    const hasAbonement = await checkClientAbonement(companyId, clientId);
    res.json({ clientType: hasAbonement ? 'regular' : 'primary' });
  } catch (err) {
    console.error('client-type error:', err);
    res.json({ clientType: 'primary' });
  }
});

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
    const today = getMoscowToday();

    const visits = await getVisitsByPhone(companyId, today, phone);
    res.json({ visits });
  } catch (err) {
    console.error('YClients search by phone error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/yclients/today-schedule', async (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRes = await db.query('SELECT id, role, studio_id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'master') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const user = userRes.rows[0];
    if (!user.studio_id) return res.json({ visits: [] });

    const studioRes = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [user.studio_id]);
    if (studioRes.rows.length === 0 || !studioRes.rows[0].yclients_id) {
      return res.json({ visits: [] });
    }

    const companyId = studioRes.rows[0].yclients_id;

    let scheduleDate = getMoscowToday();
    if (req.query.date === 'yesterday') {
      const m = getMoscowNow();
      m.setDate(m.getDate() - 1);
      const y = m.getFullYear();
      const mo = String(m.getMonth() + 1).padStart(2, '0');
      const d = String(m.getDate()).padStart(2, '0');
      scheduleDate = `${y}-${mo}-${d}`;
    }

    const visits = await getTodaySchedule(companyId, scheduleDate);

    const incomesRes = await db.query(
      `SELECT SUM(amount) as total, 
              array_agg(client_phone) as phones,
              array_agg(yclients_data) as yc_data_arr
       FROM master_incomes 
       WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, scheduleDate]
    );
    const todayTotal = parseFloat(incomesRes.rows[0]?.total) || 0;

    const recordedPhones = [];
    for (const phone of (incomesRes.rows[0]?.phones || [])) {
      if (phone) {
        const digits = phone.replace(/\D/g, '').slice(-10);
        if (digits.length >= 10 && !recordedPhones.includes(digits)) recordedPhones.push(digits);
      }
    }

    const recordedRecordIds = [];
    for (const ycData of (incomesRes.rows[0]?.yc_data_arr || [])) {
      if (ycData && ycData.recordId) {
        const rid = String(ycData.recordId);
        if (!recordedRecordIds.includes(rid)) recordedRecordIds.push(rid);
      }
      if (ycData && ycData.recordIds) {
        for (const rid of ycData.recordIds) {
          if (rid && !recordedRecordIds.includes(String(rid))) recordedRecordIds.push(String(rid));
        }
      }
    }

    res.json({ visits, todayTotal, recordedPhones, recordedRecordIds });
  } catch (err) {
    console.error('YClients today-schedule error:', err);
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

    // Also get all company IDs to build a global id→code map (cross-company field ID mismatch)
    const allStudiosRes = await db.query('SELECT DISTINCT yclients_id FROM studios WHERE yclients_id IS NOT NULL');
    const allCompanyIds = allStudiosRes.rows.map(r => r.yclients_id);

    const [record, client, recordCodeMap, clientCodeMap] = await Promise.all([
      recordId ? getRecord(companyId, recordId) : null,
      clientId ? getClientDetails(companyId, clientId) : null,
      buildGlobalFieldCodeMap('record', allCompanyIds),
      buildGlobalFieldCodeMap('client', allCompanyIds),
    ]);

    // YClients may return custom_fields as:
    // - array of objects [{id, title, value, ...}]
    // - object keyed by code {"referrer": "value"} → convert to [{code, value}]
    const normaliseFields = (fields, codeMap) => {
      if (!fields) return [];
      if (Array.isArray(fields)) {
        // Array of objects — enrich with code via global map
        return fields.map(f => ({
          ...f,
          code: codeMap.get(f.id) || f.code || null,
        }));
      }
      // Object keyed by code: {"referrer": "122365"} → [{code: "referrer", value: "122365"}]
      return Object.entries(fields).map(([code, value]) => ({ code, value: String(value ?? '') }));
    };

    res.json({
      comment: record?.comment || '',
      recordCustomFields: normaliseFields(record?.custom_fields, recordCodeMap),
      clientCustomFields: normaliseFields(client?.custom_fields, clientCodeMap),
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

function enrichFieldsWithCode(fields, codeMap) {
  if (!fields || fields.length === 0) return fields;
  return fields.map(f => {
    if (f.code) return f; // already has code
    const code = codeMap.get(f.id);
    return code ? { ...f, code } : f;
  });
}

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

    // Fetch all YClients company IDs from DB for cross-company field code resolution
    const allStudiosRes = await db.query('SELECT DISTINCT yclients_id FROM studios WHERE yclients_id IS NOT NULL');
    const allCompanyIds = allStudiosRes.rows.map(r => r.yclients_id);

    // Build global id→code maps so fields configured from any company are resolved correctly
    const [recordCodeMap, clientCodeMap] = await Promise.all([
      (recordCustomFields && recordCustomFields.length > 0) ? buildGlobalFieldCodeMap('record', allCompanyIds) : Promise.resolve(new Map()),
      (clientCustomFields && clientCustomFields.length > 0) ? buildGlobalFieldCodeMap('client', allCompanyIds) : Promise.resolve(new Map()),
    ]);

    const enrichedRecordFields = enrichFieldsWithCode(recordCustomFields, recordCodeMap);
    const enrichedClientFields = enrichFieldsWithCode(clientCustomFields, clientCodeMap);

    if (recordId && (comment !== undefined || (enrichedRecordFields && enrichedRecordFields.length > 0))) {
      const payload = {};
      if (comment !== undefined) payload.comment = comment;
      if (enrichedRecordFields && enrichedRecordFields.length > 0) payload.custom_fields = enrichedRecordFields;
      results.record = await updateRecord(companyId, recordId, payload);
    }

    if (clientId && enrichedClientFields && enrichedClientFields.length > 0) {
      results.client = await updateClientCustomFields(companyId, clientId, enrichedClientFields);
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('update-record error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
