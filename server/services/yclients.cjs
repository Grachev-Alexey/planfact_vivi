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

function extractClientName(transaction) {
  const desc = transaction.description || '';
  const parts = desc.split('|').map(s => s.trim());
  if (parts.length >= 2) {
    const name = parts[1];
    if (name && !/^\+?\d[\d\s\-()]+$/.test(name)) {
      return name;
    }
  }
  return null;
}

function normalizeForCompare(str) {
  return (str || '').toLowerCase().replace(/ё/g, 'е').trim();
}

function clientNameMatch(ycName, txName) {
  if (!ycName || !txName) return 0;
  const a = normalizeForCompare(ycName);
  const b = normalizeForCompare(txName);
  if (a === b) return 1;
  const aParts = a.split(/\s+/).filter(Boolean);
  const bParts = b.split(/\s+/).filter(Boolean);
  if (aParts.length === 0 || bParts.length === 0) return 0;
  let matched = 0;
  for (const bp of bParts) {
    if (aParts.some(ap => ap === bp || ap.startsWith(bp) || bp.startsWith(ap))) matched++;
  }
  const score = matched / Math.max(aParts.length, bParts.length);
  return score >= 0.5 ? score : 0;
}

function matchTransaction(transaction, ycRecords, contractorName) {
  const txAmount = parseFloat(transaction.amount);
  const txDate = transaction.date instanceof Date
    ? transaction.date.toISOString().split('T')[0]
    : String(transaction.date).split('T')[0];

  const txClientName = contractorName || extractClientName(transaction);

  const candidates = [];
  for (const rec of ycRecords) {
    if (rec.attendance !== 1 && rec.visit_attendance !== 1 && rec.attendance !== 2 && rec.visit_attendance !== 2) continue;
    const recDate = rec.date.split(' ')[0];
    if (recDate !== txDate) continue;

    const recTotal = rec.services.reduce((sum, s) => sum + (s.cost_to_pay || 0), 0);
    const diff = Math.abs(txAmount - recTotal);
    const recClientName = rec.client?.name || rec.client?.display_name || '';
    const nameScore = txClientName ? clientNameMatch(recClientName, txClientName) : 0;

    candidates.push({
      recordId: String(rec.id),
      visitId: rec.visit_id,
      clientName: recClientName,
      clientPhone: rec.client?.phone || '',
      recAmount: recTotal,
      diff,
      nameScore,
      services: rec.services.map(s => s.title).join(', '),
      date: recDate,
    });
  }

  candidates.sort((a, b) => {
    if (a.nameScore > 0.5 && b.nameScore <= 0.5) return -1;
    if (b.nameScore > 0.5 && a.nameScore <= 0.5) return 1;
    if (a.nameScore > 0.5 && b.nameScore > 0.5) {
      if (Math.abs(a.nameScore - b.nameScore) > 0.1) return b.nameScore - a.nameScore;
    }
    return a.diff - b.diff;
  });

  const best = candidates[0];
  if (!best) return { status: 'not_found', data: null };

  const result = { ...best };
  delete result.nameScore;

  if (best.nameScore >= 0.5 && best.diff === 0) {
    return { status: 'match', data: result };
  } else if (best.nameScore >= 0.5) {
    return { status: 'amount_mismatch', data: result };
  } else if (best.diff === 0) {
    return { status: 'match', data: result };
  } else {
    return { status: 'amount_mismatch', data: result };
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
    let contractorName = null;
    if (tx.contractor_id) {
      const cRes = await db.query('SELECT name FROM contractors WHERE id = $1', [tx.contractor_id]);
      if (cRes.rows.length > 0) contractorName = cRes.rows[0].name;
    }

    const records = await getRecords(tx.yclients_id, txDate, txDate);
    const result = matchTransaction(tx, records, contractorName);

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

  const contractorIds = [...new Set(txRes.rows.filter(t => t.contractor_id).map(t => t.contractor_id))];
  const contractorMap = {};
  if (contractorIds.length > 0) {
    const cRes = await db.query('SELECT id, name FROM contractors WHERE id = ANY($1)', [contractorIds]);
    for (const c of cRes.rows) contractorMap[c.id] = c.name;
  }

  for (const tx of txRes.rows) {
    const availableRecords = records.filter(r => !usedRecords.has(String(r.id)));
    const contractorName = tx.contractor_id ? contractorMap[tx.contractor_id] || null : null;
    const result = matchTransaction(tx, availableRecords, contractorName);

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
