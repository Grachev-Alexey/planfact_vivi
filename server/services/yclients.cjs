const db = require('../db.cjs');

const YCLIENTS_PARTNER_TOKEN = process.env.YCLIENTS_PARTNER_TOKEN;
const YCLIENTS_USER_TOKEN = process.env.YCLIENTS_USER_TOKEN;
const BASE_URL = 'https://api.yclients.com/api/v1';

// Вспомогательная функция для форматирования даты без сдвига часовых поясов
function formatDateLocal(dateInput) {
  if (!dateInput) return '';
  if (dateInput instanceof Date) {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // Если это уже строка, просто обрезаем время
  return String(dateInput).split('T')[0];
}

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

function normalizeForCompare(str) {
  return (str || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function clientNameScore(ycName, txName) {
  if (!ycName || !txName) return 0;
  const a = normalizeForCompare(ycName);
  const b = normalizeForCompare(txName);
  if (a === b) return 1;
  const aParts = a.split(' ').filter(Boolean);
  const bParts = b.split(' ').filter(Boolean);
  if (aParts.length === 0 || bParts.length === 0) return 0;
  let matched = 0;
  for (const bp of bParts) {
    if (aParts.some(ap => ap === bp || (bp.length >= 3 && ap.startsWith(bp)) || (ap.length >= 3 && bp.startsWith(ap)))) {
      matched++;
    }
  }
  return matched / Math.max(aParts.length, bParts.length);
}

function extractClientName(description) {
  if (!description) return null;
  const parts = description.split('|').map(s => s.trim());
  if (parts.length >= 2) {
    const candidate = parts[1];
    if (candidate && !/^\+?\d[\d\s\-()]+$/.test(candidate) && candidate.length >= 2) {
      return candidate;
    }
  }
  return null;
}

function extractClientPhone(description) {
  if (!description) return null;
  const parts = description.split('|').map(s => s.trim());
  for (const part of parts) {
    const digits = part.replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
  }
  return null;
}

function phoneMatch(ycPhone, txPhone) {
  if (!ycPhone || !txPhone) return false;
  const a = ycPhone.replace(/\D/g, '').slice(-10);
  const b = txPhone.replace(/\D/g, '').slice(-10);
  return a.length >= 10 && b.length >= 10 && a === b;
}

function groupRecordsByVisit(records, txDate) {
  const visits = new Map();
  for (const rec of records) {
    if (rec.attendance !== 1 && rec.visit_attendance !== 1 && rec.attendance !== 2 && rec.visit_attendance !== 2) continue;
    const recDate = (rec.date || '').split(' ')[0];
    if (recDate !== txDate) continue;

    const key = rec.visit_id || rec.id;
    if (!visits.has(key)) {
      const rawName = rec.client?.name || rec.client?.display_name || '';
      const rawSurname = rec.client?.surname || '';
      visits.set(key, {
        visitId: rec.visit_id || null,
        recordIds: [],
        clientId: rec.client?.id || null,
        clientFirstName: rawName,
        clientLastName: rawSurname,
        clientName: [rawSurname, rawName].filter(Boolean).join(' ') || rawName,
        clientPhone: rec.client?.phone || '',
        services: [],
        goods: [],
        totalAmount: 0,
        goodsAmount: 0,
        date: recDate,
      });
    }
    const visit = visits.get(key);
    visit.recordIds.push(String(rec.id));
    if (rec.services) {
      for (const s of rec.services) {
        const amount = parseFloat(s.cost_to_pay) || 0;
        visit.services.push({ title: s.title, amount });
        visit.totalAmount += amount;
      }
    }
    if (rec.goods_transactions) {
      for (const g of rec.goods_transactions) {
        const amount = parseFloat(g.cost_to_pay) || parseFloat(g.cost) || 0;
        if (amount > 0) {
          visit.goods.push({ title: g.title, amount });
          visit.goodsAmount += amount;
          visit.totalAmount += amount;
        }
      }
    }
  }
  return [...visits.values()];
}

function findServiceSubsetMatch(services, targetAmount) {
  const nonZero = services.filter(s => s.amount > 0);
  if (nonZero.length === 0) return null;

  const totalAll = nonZero.reduce((s, x) => s + x.amount, 0);
  if (Math.abs(targetAmount - totalAll) < 0.01) {
    return { matched: nonZero, type: 'full' };
  }

  for (const s of nonZero) {
    if (Math.abs(s.amount - targetAmount) < 0.01) {
      return { matched: [s], type: 'single_service' };
    }
  }

  const target = Math.round(targetAmount * 100);
  const amounts = nonZero.map(s => Math.round(s.amount * 100));
  const n = amounts.length;

  if (n <= 20) {
    const dp = new Map();
    dp.set(0, []);
    for (let i = 0; i < n; i++) {
      const entries = [...dp.entries()];
      for (const [sum, indices] of entries) {
        const newSum = sum + amounts[i];
        if (newSum <= target && !dp.has(newSum)) {
          dp.set(newSum, [...indices, i]);
        }
      }
      if (dp.has(target)) {
        return { matched: dp.get(target).map(i => nonZero[i]), type: 'subset' };
      }
    }
  }

  return null;
}

function scoreVisitMatch(visit, txAmount, txClientName, txClientPhone, contractorName, contractorPhone) {
  let score = 0;
  let signals = [];

  if (contractorPhone && phoneMatch(visit.clientPhone, contractorPhone)) {
    score += 150;
    signals.push('contractor_phone');
  } else if (txClientPhone && phoneMatch(visit.clientPhone, txClientPhone)) {
    score += 80;
    signals.push('phone');
  }

  const nameToMatch = contractorName || txClientName;
  if (nameToMatch) {
    const ns = clientNameScore(visit.clientName, nameToMatch);
    if (ns >= 0.8) {
      score += 100;
      signals.push('name_exact');
    } else if (ns >= 0.5) {
      score += 60;
      signals.push('name_partial');
    }
  }

  const amountDiff = Math.abs(txAmount - visit.totalAmount);
  if (amountDiff < 0.01) {
    score += 50;
    signals.push('amount_exact');
  } else {
    const allItems = [...visit.services, ...visit.goods];
    const subsetMatch = findServiceSubsetMatch(allItems, txAmount);
    if (subsetMatch) {
      score += 40;
      signals.push('amount_subset');
    } else if (visit.goodsAmount > 0 && Math.abs(txAmount - visit.goodsAmount) < 0.01) {
      score += 45;
      signals.push('goods_exact');
    } else if (amountDiff / Math.max(txAmount, visit.totalAmount) < 0.1) {
      score += 10;
      signals.push('amount_close');
    }
  }

  return { score, signals };
}

function matchTransaction(transaction, ycRecords, contractorName, contractorPhone, excludeVisitKeys) {
  const txAmount = parseFloat(transaction.amount);

  // ИСПРАВЛЕНО: используем локальное форматирование даты
  const txDate = formatDateLocal(transaction.date);

  const txClientName = extractClientName(transaction.description);
  const txClientPhone = extractClientPhone(transaction.description);

  let visits = groupRecordsByVisit(ycRecords, txDate);
  if (excludeVisitKeys && excludeVisitKeys.size > 0) {
    visits = visits.filter(v => !excludeVisitKeys.has(String(v.visitId || v.recordIds[0])));
  }
  if (visits.length === 0) return { status: 'not_found', data: null };

  const scored = visits.map(visit => {
    const { score, signals } = scoreVisitMatch(visit, txAmount, txClientName, txClientPhone, contractorName, contractorPhone);
    const diff = Math.abs(txAmount - visit.totalAmount);
    const allItems = [...visit.services, ...visit.goods];
    const subsetMatch = findServiceSubsetMatch(allItems, txAmount);

    return {
      visit,
      score,
      signals,
      diff,
      subsetMatch,
    };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.diff - b.diff;
  });

  const best = scored[0];

  if (best.score === 0) {
    return { status: 'not_found', data: null };
  }

  const hasNameOrPhone = best.signals.some(s => s.startsWith('name_') || s === 'phone' || s === 'contractor_phone');
  const hasExactAmount = best.signals.includes('amount_exact') || best.signals.includes('amount_subset') || best.signals.includes('goods_exact');

  let status;
  if (hasNameOrPhone && hasExactAmount) {
    status = 'match';
  } else if (hasNameOrPhone) {
    status = 'amount_mismatch';
  } else if (hasExactAmount) {
    status = 'weak_match';
  } else {
    status = 'not_found';
  }

  const v = best.visit;
  const nonZeroServices = v.services.filter(s => s.amount > 0);
  const nonZeroGoods = v.goods.filter(g => g.amount > 0);

  const visitKey = String(v.visitId || v.recordIds[0]);
  const allItemsStr = [
    ...nonZeroServices.map(s => `${s.title} (${s.amount}₽)`),
    ...nonZeroGoods.map(g => `🛍 ${g.title} (${g.amount}₽)`),
  ].join(', ');
  const data = {
    recordId: v.recordIds[0],
    visitId: v.visitId,
    visitKey,
    clientName: v.clientName,
    clientPhone: v.clientPhone,
    recAmount: v.totalAmount,
    diff: best.diff,
    services: allItemsStr,
    goods: nonZeroGoods.length > 0 ? nonZeroGoods.map(g => `${g.title} (${g.amount}₽)`).join(', ') : null,
    matchedServices: best.subsetMatch
      ? best.subsetMatch.matched.map(s => `${s.title} (${s.amount}₽)`).join(', ')
      : null,
    signals: best.signals,
    date: v.date,
  };

  return { status, data };
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

  // ИСПРАВЛЕНО: используем локальное форматирование даты
  const txDate = formatDateLocal(tx.date);

  try {
    let contractorName = null;
    let contractorPhone = null;
    if (tx.contractor_id) {
      const cRes = await db.query('SELECT name, phone FROM contractors WHERE id = $1', [tx.contractor_id]);
      if (cRes.rows.length > 0) {
        contractorName = cRes.rows[0].name;
        contractorPhone = cRes.rows[0].phone || null;
      }
    }

    const records = await getRecords(tx.yclients_id, txDate, txDate);
    const result = matchTransaction(tx, records, contractorName, contractorPhone);

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

  const contractorIds = [...new Set(txRes.rows.filter(t => t.contractor_id).map(t => t.contractor_id))];
  const contractorMap = {};
  if (contractorIds.length > 0) {
    const cRes = await db.query('SELECT id, name, phone FROM contractors WHERE id = ANY($1)', [contractorIds]);
    for (const c of cRes.rows) contractorMap[c.id] = { name: c.name, phone: c.phone };
  }

  for (const tx of txRes.rows) {
    const contractor = tx.contractor_id ? contractorMap[tx.contractor_id] || null : null;
    const result = matchTransaction(tx, records, contractor?.name || null, contractor?.phone || null);

    const now = new Date();
    await db.query(
      `UPDATE transactions SET yclients_status = $1, yclients_record_id = $2, yclients_data = $3, yclients_checked_at = $4 WHERE id = $5`,
      [result.status, result.data?.recordId || null, result.data ? JSON.stringify(result.data) : null, now, tx.id]
    );

    results.push({ transactionId: tx.id, ...result });
  }

  return { verified: results.length, results };
}

async function updateClientInfo(companyId, clientId, fields) {
  const current = await yclientsRequest(`/client/${companyId}/${clientId}`);
  const payload = {
    name: current.name || '',
    phone: current.phone || '',
    ...fields,
  };
  console.log('updateClientInfo payload:', JSON.stringify(payload));
  const url = `${BASE_URL}/client/${companyId}/${clientId}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YCLIENTS_PARTNER_TOKEN}, User ${YCLIENTS_USER_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) {
    console.error('YClients updateClientInfo full response:', JSON.stringify(data));
    throw new Error(`YClients client update error: ${data.meta?.message || data.meta?.errors?.join(', ') || JSON.stringify(data)}`);
  }
  return data.data;
}

async function yclientsRequestPost(path, method, body) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Accept': 'application/vnd.yclients.v2+json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YCLIENTS_PARTNER_TOKEN}, User ${YCLIENTS_USER_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) {
    console.error(`YClients API error (${method} ${path}) full response:`, JSON.stringify(data));
    throw new Error(`YClients API error (${method} ${path}): ${data.meta?.message || JSON.stringify(data)}`);
  }
  return data.data;
}

async function getRecord(companyId, recordId) {
  try {
    return await yclientsRequest(`/record/${companyId}/${recordId}`);
  } catch (err) {
    console.error('getRecord error:', err.message);
    return null;
  }
}

function toFieldsArray(fields) {
  if (!fields) return [];
  if (Array.isArray(fields)) return fields;
  return Object.values(fields);
}

async function updateRecord(companyId, recordId, fields) {
  // GET current record to include required fields (YClients requires them all in PUT)
  const current = await yclientsRequest(`/record/${companyId}/${recordId}`);
  const staff = Array.isArray(current.staff) ? current.staff[0] : current.staff;

  // Required fields + fields that YClients resets to default if omitted
  const payload = {
    staff_id: staff?.id,
    services: (current.services || []).map(s => ({ id: s.id, cost: s.cost, amount: s.amount || 1 })),
    client: current.client ? { id: current.client.id } : {},
    datetime: current.datetime,
    seance_length: current.seance_length,
    attendance: current.attendance ?? 0,
  };

  // Only add the fields we actually want to change
  if (fields.comment !== undefined) {
    payload.comment = fields.comment;
  }

  if (fields.custom_fields && fields.custom_fields.length > 0) {
    const customFieldsObj = {};
    for (const changed of fields.custom_fields) {
      const apiKey = changed.code || String(changed.id);
      customFieldsObj[apiKey] = changed.value;
    }
    payload.custom_fields = customFieldsObj;
  }

  console.log('updateRecord payload for', recordId, ':', JSON.stringify(payload));
  return yclientsRequestPost(`/record/${companyId}/${recordId}`, 'PUT', payload);
}

async function getClientDetails(companyId, clientId) {
  try {
    return await yclientsRequest(`/client/${companyId}/${clientId}`);
  } catch (err) {
    console.error('getClientDetails error:', err.message);
    return null;
  }
}

async function updateClientCustomFields(companyId, clientId, customFields) {
  // GET current client — name and phone are required by YClients PUT /client
  const current = await yclientsRequest(`/client/${companyId}/${clientId}`);

  // Build custom_fields as object {code: value} — only the changed fields
  const customFieldsObj = {};
  for (const changed of customFields) {
    const apiKey = changed.code || String(changed.id);
    customFieldsObj[apiKey] = changed.value;
  }

  console.log('updateClientCustomFields client', clientId, 'payload:', JSON.stringify({ name: current.name, phone: current.phone, custom_fields: customFieldsObj }));
  return yclientsRequestPost(`/client/${companyId}/${clientId}`, 'PUT', {
    name: current.name || '',
    phone: current.phone || '',
    custom_fields: customFieldsObj,
  });
}

async function getAvailableCustomFields(companyId) {
  // GET /api/v1/custom_fields/{field_category}/{company_id}
  const parseFields = (data) => {
    if (!Array.isArray(data)) return [];
    return data.map(item => {
      const cf = item.custom_field || {};
      const name = cf.name || cf.title || cf.label || item.name || item.title || `Поле ${item.id}`;
      const code = cf.code || cf.api_key || null;
      return { id: item.id, name, code };
    });
  };

  const [recordRes, clientRes] = await Promise.allSettled([
    yclientsRequest(`/custom_fields/record/${companyId}`),
    yclientsRequest(`/custom_fields/client/${companyId}`),
  ]);

  const record = recordRes.status === 'fulfilled' ? parseFields(recordRes.value) : [];
  const client = clientRes.status === 'fulfilled' ? parseFields(clientRes.value) : [];

  if (recordRes.status === 'rejected') console.error('custom_fields/record error:', recordRes.reason?.message);
  if (clientRes.status === 'rejected') console.error('custom_fields/client error:', clientRes.reason?.message);

  console.log(`[getAvailableCustomFields] companyId=${companyId} record=${record.length} client=${client.length}`);
  return { record, client };
}

async function getVisitsByPhone(companyId, date, phone) {
  const records = await getRecords(companyId, date, date);
  const visits = groupRecordsByVisit(records, date);

  if (!phone) return visits;

  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return [];

  return visits.filter(v => {
    const vDigits = (v.clientPhone || '').replace(/\D/g, '').slice(-10);
    return vDigits.length >= 10 && vDigits === digits;
  });
}

// Build a global id→code map for a given field category across multiple company IDs.
// This resolves the case where field outer IDs differ between companies for the same field.
async function checkClientAbonement(companyId, clientId) {
  try {
    const today = new Date();
    const yesterday = new Date(today - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneYearAgo = new Date(today - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const records = await yclientsRequest(
      `/records/${companyId}?start_date=${oneYearAgo}&end_date=${yesterday}&client_id=${clientId}&count=200`
    );

    if (!Array.isArray(records)) return false;

    for (const rec of records) {
      const goods = rec.goods_transactions || [];
      const services = rec.services || [];
      for (const item of [...goods, ...services]) {
        if (item.title && item.title.toLowerCase().includes('абонемент')) return true;
      }
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function buildGlobalFieldCodeMap(category, companyIds) {
  const map = new Map();
  await Promise.allSettled((companyIds || []).map(async (companyId) => {
    try {
      const defs = await yclientsRequest(`/custom_fields/${category}/${companyId}`);
      if (Array.isArray(defs)) {
        for (const def of defs) {
          const code = def.custom_field?.code || def.custom_field?.api_key || null;
          if (code) map.set(def.id, code);
        }
      }
    } catch (_) {}
  }));
  return map;
}

module.exports = { verifyTransaction, verifyBatch, getRecords, getVisitsByPhone, updateClientInfo, getRecord, updateRecord, getClientDetails, updateClientCustomFields, getAvailableCustomFields, buildGlobalFieldCodeMap, checkClientAbonement };