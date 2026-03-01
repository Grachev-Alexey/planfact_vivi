const db = require('../db.cjs');

const YCLIENTS_PARTNER_TOKEN = process.env.YCLIENTS_PARTNER_TOKEN;
const YCLIENTS_USER_TOKEN = process.env.YCLIENTS_USER_TOKEN;
const BASE_URL = 'https://api.yclients.com/api/v1';

async function yclientsRequest(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.yclients.v2+json',
      'Authorization': `Bearer ${YCLIENTS_PARTNER_TOKEN}, User ${YCLIENTS_USER_TOKEN}`,
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`YClients API error: ${data.meta?.message || 'Unknown'}`);
  }
  return data.data;
}

async function getRecords(companyId, startDate, endDate) {
  const allRecords = [];
  let page = 1;
  const pageSize = 200;
  while (true) {
    const records = await yclientsRequest(
      `/records/${companyId}?start_date=${startDate}&end_date=${endDate}&count=${pageSize}&page=${page}`
    );
    if (!records || records.length === 0) break;
    allRecords.push(...records);
    if (records.length < pageSize) break;
    page++;
  }
  return allRecords;
}

function matchTransaction(transaction, ycRecords) {
  const txAmount = parseFloat(transaction.amount);
  const txDate = transaction.date instanceof Date
    ? transaction.date.toISOString().split('T')[0]
    : String(transaction.date).split('T')[0];

  const candidates = [];
  for (const rec of ycRecords) {
    if (rec.attendance !== 1 && rec.visit_attendance !== 1 && rec.attendance !== 2 && rec.visit_attendance !== 2) continue;
    const recDate = rec.date.split(' ')[0];
    if (recDate !== txDate) continue;

    const recTotal = rec.services.reduce((sum, s) => sum + (s.cost_to_pay || 0), 0);
    const diff = Math.abs(txAmount - recTotal);
    candidates.push({
      recordId: String(rec.id),
      visitId: rec.visit_id,
      clientName: rec.client?.name || rec.client?.display_name || '',
      clientPhone: rec.client?.phone || '',
      recAmount: recTotal,
      diff,
      services: rec.services.map(s => s.title).join(', '),
      date: recDate,
    });
  }

  candidates.sort((a, b) => a.diff - b.diff);
  const best = candidates[0];
  if (!best) return { status: 'not_found', data: null };

  if (best.diff === 0) {
    return { status: 'match', data: best };
  } else {
    return { status: 'amount_mismatch', data: best };
  }
}

async function verifyTransaction(transactionId) {
  const txRes = await db.query(
    'SELECT t.*, s.yclients_id FROM transactions t LEFT JOIN studios s ON t.studio_id = s.id WHERE t.id = $1',
    [transactionId]
  );
  if (txRes.rows.length === 0) return { error: 'Transaction not found' };

  const tx = txRes.rows[0];

  if (tx.type !== 'income') {
    return { status: 'skip', message: 'Только поступления проверяются' };
  }

  if (!tx.yclients_id) {
    return { status: 'no_studio', message: 'Студия не привязана к YClients' };
  }

  const txDate = tx.date instanceof Date
    ? tx.date.toISOString().split('T')[0]
    : String(tx.date).split('T')[0];

  try {
    const records = await getRecords(tx.yclients_id, txDate, txDate);
    const result = matchTransaction(tx, records);

    const now = new Date();
    await db.query(
      `UPDATE transactions SET yclients_status = $1, yclients_record_id = $2, yclients_data = $3, yclients_checked_at = $4 WHERE id = $5`,
      [result.status, result.data?.recordId || null, result.data ? JSON.stringify(result.data) : null, now, transactionId]
    );

    return {
      status: result.status,
      data: result.data,
      checkedAt: now.toISOString(),
    };
  } catch (err) {
    console.error('YClients verification error:', err);
    return { status: 'error', message: err.message };
  }
}

async function verifyBatch(studioId, dateFrom, dateTo) {
  const studioRes = await db.query('SELECT id, yclients_id FROM studios WHERE id = $1', [studioId]);
  if (studioRes.rows.length === 0 || !studioRes.rows[0].yclients_id) {
    return { error: 'Studio not linked to YClients' };
  }

  const yclientsId = studioRes.rows[0].yclients_id;

  const txRes = await db.query(
    `SELECT * FROM transactions WHERE type = 'income' AND studio_id = $1 AND date >= $2 AND date <= $3 AND (confirmed = false OR confirmed IS NULL)`,
    [studioId, dateFrom, dateTo]
  );

  if (txRes.rows.length === 0) return { verified: 0, results: [] };

  const records = await getRecords(yclientsId, dateFrom, dateTo);
  const results = [];
  const usedRecords = new Set();

  for (const tx of txRes.rows) {
    const availableRecords = records.filter(r => !usedRecords.has(String(r.id)));
    const result = matchTransaction(tx, availableRecords);

    if (result.data?.recordId) {
      usedRecords.add(result.data.recordId);
    }

    const now = new Date();
    await db.query(
      `UPDATE transactions SET yclients_status = $1, yclients_record_id = $2, yclients_data = $3, yclients_checked_at = $4 WHERE id = $5`,
      [result.status, result.data?.recordId || null, result.data ? JSON.stringify(result.data) : null, now, tx.id]
    );

    results.push({ transactionId: tx.id, ...result });
  }

  return { verified: results.length, results };
}

module.exports = { verifyTransaction, verifyBatch, getRecords };
