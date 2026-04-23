const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');
const { autoCalculateCreditDate, resolveSettlementAccount } = require('../utils/creditDate.cjs');
const { getMoscowToday, getMoscowNow } = require('../utils/moscow.cjs');

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return digits.slice(1);
  return digits;
}

let _hasExternalId = null;
async function hasExternalIdColumn() {
  if (_hasExternalId !== null) return _hasExternalId;
  try {
    const res = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='external_id'`);
    _hasExternalId = res.rows.length > 0;
    return _hasExternalId;
  } catch (err) {
    console.error('Error checking external_id column:', err);
    return false;
  }
}

const PAYMENT_TYPE_SUFFIXES = {
  cash: 'Наличные',
  card: 'Карта',
  sbp: 'СБП',
  ukassa: 'Ю-Касса',
  installment: 'Рассрочка',
};

async function requireMaster(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const userRes = await db.query('SELECT id, role, studio_id FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) { res.status(401).json({ error: 'User not found' }); return null; }
  const user = userRes.rows[0];
  if (user.role !== 'master') { res.status(403).json({ error: 'Forbidden: master role required' }); return null; }
  return user;
}

async function resolveAccountId(studioId, paymentType) {
  if (!studioId || !PAYMENT_TYPE_SUFFIXES[paymentType]) return null;
  const studioRes = await db.query('SELECT name FROM studios WHERE id = $1', [studioId]);
  if (studioRes.rows.length === 0) return null;
  const studioName = studioRes.rows[0].name;
  const accountName = `${studioName} ${PAYMENT_TYPE_SUFFIXES[paymentType]}`;
  const accRes = await db.query('SELECT id FROM accounts WHERE name = $1', [accountName]);
  if (accRes.rows.length === 0) return null;
  return accRes.rows[0].id;
}

async function requireAdminOrRequester(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const userRes = await db.query('SELECT id, role FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length === 0) { res.status(401).json({ error: 'User not found' }); return null; }
  const user = userRes.rows[0];
  if (user.role !== 'admin' && user.role !== 'requester' && user.role !== 'payout_controller') { res.status(403).json({ error: 'Forbidden' }); return null; }
  return user;
}

router.get('/admin-stats', async (req, res) => {
  const caller = await requireAdminOrRequester(req, res);
  if (!caller) return;

  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });

    const abonementCategoryIds = [9, 10];

    // 1. Per-master summary
    const summaryRes = await db.query(
      `SELECT
        mi.user_id, u.username as master_name, mi.studio_id, s.name as studio_name,
        COALESCE(SUM(mi.amount), 0) as total_amount,
        COUNT(*) as total_entries,
        COALESCE(SUM(mi.amount) FILTER (WHERE mi.client_type = 'primary'), 0) as primary_amount,
        COALESCE(SUM(mi.amount) FILTER (WHERE mi.client_type = 'regular'), 0) as regular_amount,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'primary' AND mi.client_phone != '') as primary_count,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'regular' AND mi.client_phone != '') as regular_count
       FROM master_incomes mi
       JOIN users u ON mi.user_id = u.id
       JOIN studios s ON mi.studio_id = s.id
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2 AND mi.payment_type != 'visit_only'
       GROUP BY mi.user_id, u.username, mi.studio_id, s.name
       ORDER BY s.name, u.username`,
      [startDate, endDate]
    );

    // 1b. Unique clients per master including visit_only (abonement) visits
    const uniqueClientsAllRes = await db.query(
      `SELECT mi.user_id,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_phone != '') as unique_clients_all,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'primary' AND mi.client_phone != '') as primary_count_all,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'regular' AND mi.client_phone != '') as regular_count_all
       FROM master_incomes mi
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2
       GROUP BY mi.user_id`,
      [startDate, endDate]
    );
    const uniqueClientsAllMap = {};
    for (const r of uniqueClientsAllRes.rows) {
      uniqueClientsAllMap[r.user_id] = {
        uniqueClients: parseInt(r.unique_clients_all) || 0,
        primaryCount: parseInt(r.primary_count_all) || 0,
        regularCount: parseInt(r.regular_count_all) || 0,
      };
    }

    // 2. Per-master visit count (deduplicate by recordId first — multiple income entries per visit share the same recordId)
    const visitRes = await db.query(
      `SELECT mi.user_id,
        COUNT(DISTINCT COALESCE(mi.yclients_data->'recordIds'->>0, mi.yclients_data->>'visitId', mi.id::text)) as total_visits,
        COUNT(DISTINCT COALESCE(mi.yclients_data->'recordIds'->>0, mi.yclients_data->>'visitId', mi.id::text))
          FILTER (WHERE mi.payment_type = 'visit_only') as zero_visits
       FROM master_incomes mi
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2
       GROUP BY mi.user_id`,
      [startDate, endDate]
    );

    // 3. Per-master abonement stats (deduplicated by visitId)
    const abonementRes = await db.query(
      `SELECT deduped.user_id, deduped.client_type,
        COALESCE(SUM(deduped.goods_cost), 0) as abonement_amount,
        COALESCE(SUM(deduped.goods_count), 0) as abonement_count
       FROM (
         SELECT DISTINCT ON (mi.user_id, COALESCE(mi.yclients_data->>'visitId', mi.id::text))
           mi.user_id, mi.client_type,
           (SELECT COALESCE(SUM(COALESCE((g->>'cost_per_unit')::numeric, (g->>'cost')::numeric, 0)), 0)
            FROM jsonb_array_elements(mi.yclients_data->'goods') g
            WHERE (g->>'cost_per_unit') IS NOT NULL OR (g->>'cost') IS NOT NULL) as goods_cost,
           jsonb_array_length(mi.yclients_data->'goods') as goods_count
         FROM master_incomes mi
         WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2
           AND mi.payment_type != 'visit_only'
           AND mi.category_id = ANY($3)
           AND mi.yclients_data IS NOT NULL
           AND mi.yclients_data ? 'goods'
           AND jsonb_array_length(mi.yclients_data->'goods') > 0
         ORDER BY mi.user_id, COALESCE(mi.yclients_data->>'visitId', mi.id::text)
       ) deduped
       GROUP BY deduped.user_id, deduped.client_type`,
      [startDate, endDate, abonementCategoryIds]
    );

    // 4. Daily totals per studio for chart
    const dailyRes = await db.query(
      `SELECT mi.studio_id, DATE(mi.created_at) as date, SUM(mi.amount) as amount
       FROM master_incomes mi
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2 AND mi.payment_type != 'visit_only'
       GROUP BY mi.studio_id, DATE(mi.created_at)
       ORDER BY mi.studio_id, date`,
      [startDate, endDate]
    );

    // 5. Per-master daily totals for master charts
    const masterDailyRes = await db.query(
      `SELECT mi.user_id, DATE(mi.created_at) as date, SUM(mi.amount) as amount
       FROM master_incomes mi
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2 AND mi.payment_type != 'visit_only'
       GROUP BY mi.user_id, DATE(mi.created_at)
       ORDER BY mi.user_id, date`,
      [startDate, endDate]
    );

    // 6. Per-master payment type breakdown
    const masterPaymentRes = await db.query(
      `SELECT mi.user_id, mi.payment_type, SUM(mi.amount) as amount, COUNT(*) as count
       FROM master_incomes mi
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2 AND mi.payment_type != 'visit_only'
       GROUP BY mi.user_id, mi.payment_type
       ORDER BY mi.user_id, amount DESC`,
      [startDate, endDate]
    );

    // 7. Per-master category breakdown
    const masterCategoryRes = await db.query(
      `SELECT mi.user_id, mi.category_id, c.name as category_name, SUM(mi.amount) as amount, COUNT(*) as count
       FROM master_incomes mi
       LEFT JOIN categories c ON mi.category_id = c.id
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2 AND mi.payment_type != 'visit_only'
       GROUP BY mi.user_id, mi.category_id, c.name
       ORDER BY mi.user_id, amount DESC`,
      [startDate, endDate]
    );

    // 8. Per-master shifts (distinct working days)
    const shiftsRes = await db.query(
      `SELECT mi.user_id, COUNT(DISTINCT DATE(mi.created_at)) as total_shifts
       FROM master_incomes mi
       WHERE DATE(mi.created_at) >= $1 AND DATE(mi.created_at) <= $2 AND mi.payment_type != 'visit_only'
       GROUP BY mi.user_id`,
      [startDate, endDate]
    );
    const shiftsMap = {};
    for (const r of shiftsRes.rows) shiftsMap[r.user_id] = parseInt(r.total_shifts) || 0;

    // Build lookup maps
    const visitMap = {};
    for (const r of visitRes.rows) visitMap[r.user_id] = r;

    const abonementMap = {};
    for (const r of abonementRes.rows) {
      if (!abonementMap[r.user_id]) abonementMap[r.user_id] = { amount: 0, count: 0, primaryAmount: 0, primaryCount: 0, regularAmount: 0, regularCount: 0 };
      const a = abonementMap[r.user_id];
      const amt = parseFloat(r.abonement_amount) || 0;
      const cnt = parseInt(r.abonement_count) || 0;
      a.amount += amt; a.count += cnt;
      if (r.client_type === 'primary') { a.primaryAmount += amt; a.primaryCount += cnt; }
      else if (r.client_type === 'regular') { a.regularAmount += amt; a.regularCount += cnt; }
    }

    const dailyByStudio = {};
    for (const r of dailyRes.rows) {
      if (!dailyByStudio[r.studio_id]) dailyByStudio[r.studio_id] = [];
      dailyByStudio[r.studio_id].push({ date: r.date, amount: parseFloat(r.amount) || 0 });
    }

    const masterDailyMap = {};
    for (const r of masterDailyRes.rows) {
      if (!masterDailyMap[r.user_id]) masterDailyMap[r.user_id] = [];
      masterDailyMap[r.user_id].push({ date: r.date, amount: parseFloat(r.amount) || 0 });
    }

    const masterPaymentMap = {};
    for (const r of masterPaymentRes.rows) {
      if (!masterPaymentMap[r.user_id]) masterPaymentMap[r.user_id] = [];
      masterPaymentMap[r.user_id].push({ type: r.payment_type, amount: parseFloat(r.amount) || 0, count: parseInt(r.count) || 0 });
    }

    const masterCategoryMap = {};
    for (const r of masterCategoryRes.rows) {
      if (!masterCategoryMap[r.user_id]) masterCategoryMap[r.user_id] = [];
      masterCategoryMap[r.user_id].push({ id: r.category_id, name: r.category_name || 'Без статьи', amount: parseFloat(r.amount) || 0, count: parseInt(r.count) || 0 });
    }

    // Assemble per-studio structure
    const studioMap = {};
    for (const r of summaryRes.rows) {
      const sid = r.studio_id;
      if (!studioMap[sid]) {
        studioMap[sid] = {
          id: sid, name: r.studio_name,
          masters: [],
          daily: dailyByStudio[sid] || [],
          summary: { totalAmount: 0, totalEntries: 0, uniqueClients: 0, primaryAmount: 0, regularAmount: 0, primaryCount: 0, regularCount: 0, totalVisits: 0, zeroVisits: 0, totalShifts: 0, abonementAmount: 0, abonementCount: 0, abonementPrimaryAmount: 0, abonementPrimaryCount: 0, abonementRegularAmount: 0, abonementRegularCount: 0 }
        };
      }
      const totalAmount = parseFloat(r.total_amount) || 0;
      const totalEntries = parseInt(r.total_entries) || 0;
      const vc = visitMap[r.user_id] || {};
      const ab = abonementMap[r.user_id] || { amount: 0, count: 0, primaryAmount: 0, primaryCount: 0, regularAmount: 0, regularCount: 0 };
      const allCounts = uniqueClientsAllMap[r.user_id] || { uniqueClients: 0, primaryCount: 0, regularCount: 0 };
      const uniqueClients = allCounts.uniqueClients;
      const primaryCount = allCounts.primaryCount;
      const regularCount = allCounts.regularCount;

      const master = {
        id: r.user_id, name: r.master_name,
        summary: {
          totalAmount, totalEntries, uniqueClients,
          avgCheck: totalEntries > 0 ? Math.round(totalAmount / totalEntries) : 0,
          primaryAmount: parseFloat(r.primary_amount) || 0,
          regularAmount: parseFloat(r.regular_amount) || 0,
          primaryCount, regularCount,
          totalVisits: parseInt(vc.total_visits) || 0,
          zeroVisits: parseInt(vc.zero_visits) || 0,
          totalShifts: shiftsMap[r.user_id] || 0,
          abonementAmount: ab.amount, abonementCount: ab.count,
          abonementPrimaryAmount: ab.primaryAmount, abonementPrimaryCount: ab.primaryCount,
          abonementRegularAmount: ab.regularAmount, abonementRegularCount: ab.regularCount,
        },
        daily: masterDailyMap[r.user_id] || [],
        byPayment: masterPaymentMap[r.user_id] || [],
        byCategory: masterCategoryMap[r.user_id] || [],
      };
      studioMap[sid].masters.push(master);

      // Roll up to studio summary
      const ss = studioMap[sid].summary;
      ss.totalAmount += totalAmount;
      ss.totalEntries += totalEntries;
      ss.uniqueClients += uniqueClients;
      ss.primaryAmount += master.summary.primaryAmount;
      ss.regularAmount += master.summary.regularAmount;
      ss.primaryCount += primaryCount;
      ss.regularCount += regularCount;
      ss.totalVisits += master.summary.totalVisits;
      ss.zeroVisits += master.summary.zeroVisits;
      ss.totalShifts += master.summary.totalShifts;
      ss.abonementAmount += ab.amount;
      ss.abonementCount += ab.count;
      ss.abonementPrimaryAmount += ab.primaryAmount;
      ss.abonementPrimaryCount += ab.primaryCount;
      ss.abonementRegularAmount += ab.regularAmount;
      ss.abonementRegularCount += ab.regularCount;
    }
    // avgCheck for studios
    for (const s of Object.values(studioMap)) {
      s.summary.avgCheck = s.summary.totalEntries > 0 ? Math.round(s.summary.totalAmount / s.summary.totalEntries) : 0;
    }

    const studios = Object.values(studioMap).sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    // Overall totals
    const overall = studios.reduce((acc, s) => {
      acc.totalAmount += s.summary.totalAmount;
      acc.totalEntries += s.summary.totalEntries;
      acc.uniqueClients += s.summary.uniqueClients;
      acc.primaryAmount += s.summary.primaryAmount;
      acc.regularAmount += s.summary.regularAmount;
      acc.primaryCount += s.summary.primaryCount;
      acc.regularCount += s.summary.regularCount;
      acc.totalVisits += s.summary.totalVisits;
      acc.zeroVisits += s.summary.zeroVisits;
      acc.totalShifts += s.summary.totalShifts;
      acc.abonementAmount += s.summary.abonementAmount;
      acc.abonementCount += s.summary.abonementCount;
      acc.abonementPrimaryAmount += s.summary.abonementPrimaryAmount;
      acc.abonementPrimaryCount += s.summary.abonementPrimaryCount;
      acc.abonementRegularAmount += s.summary.abonementRegularAmount;
      acc.abonementRegularCount += s.summary.abonementRegularCount;
      return acc;
    }, { totalAmount: 0, totalEntries: 0, uniqueClients: 0, primaryAmount: 0, regularAmount: 0, primaryCount: 0, regularCount: 0, totalVisits: 0, zeroVisits: 0, totalShifts: 0, abonementAmount: 0, abonementCount: 0, abonementPrimaryAmount: 0, abonementPrimaryCount: 0, abonementRegularAmount: 0, abonementRegularCount: 0 });
    overall.avgCheck = overall.totalEntries > 0 ? Math.round(overall.totalAmount / overall.totalEntries) : 0;

    res.json({ overall, studios });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'Error fetching admin stats' });
  }
});

router.get('/master-incomes/stats', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;

  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' });

    const baseWhere = 'WHERE mi.user_id = $1 AND DATE(mi.created_at) >= $2 AND DATE(mi.created_at) <= $3 AND mi.payment_type != \'visit_only\'';
    const params = [master.id, startDate, endDate];

    const allVisitsWhere = 'WHERE mi.user_id = $1 AND DATE(mi.created_at) >= $2 AND DATE(mi.created_at) <= $3';

    const summaryRes = await db.query(
      `SELECT 
        COALESCE(SUM(mi.amount), 0) as total_amount,
        COUNT(*) as total_entries,
        COALESCE(SUM(mi.amount) FILTER (WHERE mi.client_type = 'primary'), 0) as primary_amount,
        COALESCE(SUM(mi.amount) FILTER (WHERE mi.client_type = 'regular'), 0) as regular_amount,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'primary' AND mi.client_phone != '') as primary_count,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'regular' AND mi.client_phone != '') as regular_count
      FROM master_incomes mi ${baseWhere}`,
      params
    );

    const uniqueClientsAllRes = await db.query(
      `SELECT
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_phone != '') as unique_clients_all,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'primary' AND mi.client_phone != '') as primary_count_all,
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_type = 'regular' AND mi.client_phone != '') as regular_count_all
       FROM master_incomes mi ${allVisitsWhere}`,
      params
    );

    const visitCountRes = await db.query(
      `SELECT 
        COUNT(DISTINCT COALESCE(mi.yclients_data->'recordIds'->>0, mi.yclients_data->>'visitId', mi.id::text)) as total_visits,
        COUNT(DISTINCT COALESCE(mi.yclients_data->'recordIds'->>0, mi.yclients_data->>'visitId', mi.id::text)) FILTER (WHERE mi.payment_type = 'visit_only') as zero_visits
      FROM master_incomes mi ${allVisitsWhere}`,
      params
    );

    const dailyRes = await db.query(
      `SELECT DATE(mi.created_at) as date, 
              SUM(mi.amount) as amount, 
              COUNT(*) as entries
       FROM master_incomes mi ${baseWhere}
       GROUP BY DATE(mi.created_at) ORDER BY date`,
      params
    );

    const paymentRes = await db.query(
      `SELECT mi.payment_type, SUM(mi.amount) as amount, COUNT(*) as count
       FROM master_incomes mi ${baseWhere}
       GROUP BY mi.payment_type ORDER BY amount DESC`,
      params
    );

    const categoryRes = await db.query(
      `SELECT mi.category_id, c.name as category_name, SUM(mi.amount) as amount, COUNT(*) as count
       FROM master_incomes mi 
       LEFT JOIN categories c ON mi.category_id = c.id
       ${baseWhere}
       GROUP BY mi.category_id, c.name ORDER BY amount DESC`,
      params
    );

    const shiftsRes2 = await db.query(
      `SELECT COUNT(DISTINCT DATE(mi.created_at)) as total_shifts
       FROM master_incomes mi ${baseWhere}`,
      params
    );

    const abonementCategoryIds = [9, 10];

    // Step 1: find abonement records missing YClients goods data and reload from YClients
    try {
      const missingRes = await db.query(
        `SELECT mi.id, mi.studio_id, mi.client_phone, DATE(mi.created_at)::text as date
         FROM master_incomes mi ${baseWhere} AND mi.category_id = ANY($4)
         AND (mi.yclients_data IS NULL OR NOT (mi.yclients_data ? 'goods') OR jsonb_array_length(mi.yclients_data->'goods') = 0)`,
        [...params, abonementCategoryIds]
      );

      if (missingRes.rows.length > 0) {
        const { getVisitsByPhone } = require('../services/yclients.cjs');

        const studioIds = [...new Set(missingRes.rows.map(r => r.studio_id).filter(Boolean))];
        const studioMap = {};
        await Promise.all(studioIds.map(async (sid) => {
          const sr = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [sid]);
          if (sr.rows.length > 0 && sr.rows[0].yclients_id) studioMap[sid] = sr.rows[0].yclients_id;
        }));

        // Group by (companyId|date) to avoid duplicate API calls
        const groups = {};
        for (const row of missingRes.rows) {
          const companyId = studioMap[row.studio_id];
          if (!companyId) continue;
          const key = `${companyId}|${row.date}`;
          if (!groups[key]) groups[key] = { companyId, date: row.date, rows: [] };
          groups[key].rows.push(row);
        }

        await Promise.allSettled(Object.values(groups).map(async ({ companyId, date, rows }) => {
          try {
            const allVisits = await getVisitsByPhone(companyId, date, null);
            await Promise.allSettled(rows.map(async (row) => {
              const phone10 = (row.client_phone || '').replace(/\D/g, '').slice(-10);
              const match = phone10.length >= 10
                ? allVisits.find(v => (v.clientPhone || '').replace(/\D/g, '').slice(-10) === phone10)
                : null;
              if (match) {
                await db.query(
                  `UPDATE master_incomes SET yclients_data = $1 WHERE id = $2`,
                  [JSON.stringify(match), row.id]
                );
                console.log(`[abonement-sync] Updated yclients_data for master_income ${row.id} (${row.date}, phone=${phone10}), goods=${match.goods?.length || 0}`);
              } else {
                console.log(`[abonement-sync] No YClients visit found for master_income ${row.id} (${row.date}, phone=${phone10})`);
              }
            }));
          } catch (err) {
            console.error(`[abonement-sync] Failed for companyId=${companyId} date=${date}:`, err.message);
          }
        }));
      }
    } catch (syncErr) {
      console.error('[abonement-sync] Error during YClients sync:', syncErr.message);
    }

    // Step 2a: re-sync abonement records that have goods but are missing cost_per_unit
    try {
      const missingCostPerUnitRes = await db.query(
        `SELECT mi.id, mi.studio_id, mi.client_phone, DATE(mi.created_at)::text as date
         FROM master_incomes mi ${baseWhere} AND mi.category_id = ANY($4)
         AND mi.yclients_data IS NOT NULL
         AND mi.yclients_data ? 'goods'
         AND jsonb_array_length(mi.yclients_data->'goods') > 0
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(mi.yclients_data->'goods') g
           WHERE g ? 'cost_per_unit'
         )`,
        [...params, abonementCategoryIds]
      );

      if (missingCostPerUnitRes.rows.length > 0) {
        const { getVisitsByPhone } = require('../services/yclients.cjs');

        const studioIds2 = [...new Set(missingCostPerUnitRes.rows.map(r => r.studio_id).filter(Boolean))];
        const studioMap2 = {};
        await Promise.all(studioIds2.map(async (sid) => {
          const sr = await db.query('SELECT yclients_id FROM studios WHERE id = $1', [sid]);
          if (sr.rows.length > 0 && sr.rows[0].yclients_id) studioMap2[sid] = sr.rows[0].yclients_id;
        }));

        const groups2 = {};
        for (const row of missingCostPerUnitRes.rows) {
          const companyId = studioMap2[row.studio_id];
          if (!companyId) continue;
          const key = `${companyId}|${row.date}`;
          if (!groups2[key]) groups2[key] = { companyId, date: row.date, rows: [] };
          groups2[key].rows.push(row);
        }

        await Promise.allSettled(Object.values(groups2).map(async ({ companyId, date, rows }) => {
          try {
            const allVisits = await getVisitsByPhone(companyId, date, null);
            await Promise.allSettled(rows.map(async (row) => {
              const phone10 = (row.client_phone || '').replace(/\D/g, '').slice(-10);
              const match = phone10.length >= 10
                ? allVisits.find(v => (v.clientPhone || '').replace(/\D/g, '').slice(-10) === phone10)
                : null;
              if (match) {
                await db.query(
                  `UPDATE master_incomes SET yclients_data = $1 WHERE id = $2`,
                  [JSON.stringify(match), row.id]
                );
                console.log(`[abonement-cost-sync] Updated cost_per_unit for master_income ${row.id} (${row.date}, phone=${phone10})`);
              }
            }));
          } catch (err) {
            console.error(`[abonement-cost-sync] Failed for companyId=${companyId} date=${date}:`, err.message);
          }
        }));
      }
    } catch (syncErr) {
      console.error('[abonement-cost-sync] Error:', syncErr.message);
    }

    // Step 2b: compute abonement stats using ONLY YClients goods data (no fallback)
    // Deduplicate by visitId to avoid counting split-payment records multiple times
    // Use cost_per_unit (full subscription price) with fallback to cost
    // Group by client_type to get primary/regular breakdown
    const abonementRes = await db.query(
      `SELECT 
        deduped.client_type,
        COALESCE(SUM(
          (
            SELECT COALESCE(SUM(
              COALESCE((g->>'cost_per_unit')::numeric, (g->>'cost')::numeric, 0)
            ), 0)
            FROM jsonb_array_elements(deduped.yclients_data->'goods') g
            WHERE (g->>'cost_per_unit') IS NOT NULL OR (g->>'cost') IS NOT NULL
          )
        ), 0) as abonement_amount,
        COALESCE(SUM(
          jsonb_array_length(deduped.yclients_data->'goods')
        ), 0) as abonement_count
      FROM (
        SELECT DISTINCT ON (COALESCE(mi.yclients_data->>'visitId', mi.id::text))
          mi.yclients_data,
          mi.client_type
        FROM master_incomes mi
        WHERE mi.user_id = $1 AND DATE(mi.created_at) >= $2 AND DATE(mi.created_at) <= $3
          AND mi.payment_type != 'visit_only'
          AND mi.category_id = ANY($4)
          AND mi.yclients_data IS NOT NULL
          AND mi.yclients_data ? 'goods'
          AND jsonb_array_length(mi.yclients_data->'goods') > 0
        ORDER BY COALESCE(mi.yclients_data->>'visitId', mi.id::text)
      ) deduped
      GROUP BY deduped.client_type`,
      [...params, abonementCategoryIds]
    );

    const summary = summaryRes.rows[0];
    const vcRow = visitCountRes.rows[0];

    // Aggregate abonement rows by client_type
    let abonementAmount = 0, abonementCount = 0;
    let abonementPrimaryAmount = 0, abonementPrimaryCount = 0;
    let abonementRegularAmount = 0, abonementRegularCount = 0;
    for (const row of abonementRes.rows) {
      const amt = parseFloat(row.abonement_amount) || 0;
      const cnt = parseInt(row.abonement_count) || 0;
      abonementAmount += amt;
      abonementCount += cnt;
      if (row.client_type === 'primary') {
        abonementPrimaryAmount += amt;
        abonementPrimaryCount += cnt;
      } else if (row.client_type === 'regular') {
        abonementRegularAmount += amt;
        abonementRegularCount += cnt;
      }
    }

    const totalEntries = parseInt(summary.total_entries) || 0;
    const totalAmount = parseFloat(summary.total_amount) || 0;
    const allRow = uniqueClientsAllRes.rows[0] || {};
    const uniqueClients = parseInt(allRow.unique_clients_all) || 0;
    const primaryCount = parseInt(allRow.primary_count_all) || 0;
    const regularCount = parseInt(allRow.regular_count_all) || 0;

    const totalShifts = parseInt((shiftsRes2.rows[0] || {}).total_shifts) || 0;

    res.json({
      summary: {
        totalAmount,
        totalEntries,
        uniqueClients,
        avgCheck: totalEntries > 0 ? Math.round(totalAmount / totalEntries) : 0,
        primaryAmount: parseFloat(summary.primary_amount) || 0,
        regularAmount: parseFloat(summary.regular_amount) || 0,
        primaryCount,
        regularCount,
        totalVisits: parseInt(vcRow.total_visits) || 0,
        zeroVisits: parseInt(vcRow.zero_visits) || 0,
        totalShifts,
        abonementAmount,
        abonementCount,
        abonementPrimaryAmount,
        abonementPrimaryCount,
        abonementRegularAmount,
        abonementRegularCount,
      },
      daily: dailyRes.rows.map(r => ({
        date: r.date,
        amount: parseFloat(r.amount) || 0,
        entries: parseInt(r.entries) || 0,
      })),
      byPayment: paymentRes.rows.map(r => ({
        type: r.payment_type,
        amount: parseFloat(r.amount) || 0,
        count: parseInt(r.count) || 0,
      })),
      byCategory: categoryRes.rows.map(r => ({
        id: r.category_id,
        name: r.category_name || 'Без статьи',
        amount: parseFloat(r.amount) || 0,
        count: parseInt(r.count) || 0,
      })),
    });
  } catch (err) {
    console.error('Error fetching master stats:', err);
    res.status(500).json({ error: 'Error fetching master stats' });
  }
});

router.get('/master-incomes', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;

  try {
    const result = await db.query(
      `SELECT mi.*, c.name as category_name, s.name as studio_name, a.name as account_name
       FROM master_incomes mi
       LEFT JOIN categories c ON mi.category_id = c.id
       LEFT JOIN studios s ON mi.studio_id = s.id
       LEFT JOIN accounts a ON mi.account_id = a.id
       WHERE mi.user_id = $1
       ORDER BY mi.created_at DESC
       LIMIT 100`,
      [master.id]
    );
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    console.error('Error fetching master incomes:', err);
    res.status(500).json({ error: 'Error fetching master incomes' });
  }
});

router.post('/master-incomes', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;

  const { amount, paymentType, categoryId, clientName, clientType, description, yclientsData, visitOnly, forDate } = req.body;
  const clientPhone = normalizePhone(req.body.clientPhone);

  const isVisitOnly = visitOnly === true && parseFloat(amount) === 0;

  if (!isVisitOnly) {
    if (!amount || !paymentType) {
      return res.status(400).json({ error: 'amount and paymentType required' });
    }
    if (!PAYMENT_TYPE_SUFFIXES[paymentType]) {
      return res.status(400).json({ error: 'Invalid paymentType' });
    }
  }

  let effectiveDate = getMoscowToday();
  if (forDate === 'yesterday') {
    const m = getMoscowNow();
    m.setDate(m.getDate() - 1);
    const y = m.getFullYear();
    const mo = String(m.getMonth() + 1).padStart(2, '0');
    const d = String(m.getDate()).padStart(2, '0');
    effectiveDate = `${y}-${mo}-${d}`;
  } else if (forDate && /^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
    effectiveDate = forDate;
  }

  const studioId = master.studio_id;
  let accountId = null;
  if (!isVisitOnly) {
    accountId = await resolveAccountId(studioId, paymentType);
    if (!accountId) {
      const suffix = PAYMENT_TYPE_SUFFIXES[paymentType] || paymentType;
      const studioRes = await db.query('SELECT name FROM studios WHERE id = $1', [studioId]);
      const studioName = studioRes.rows.length > 0 ? studioRes.rows[0].name : '?';
      return res.status(400).json({ error: `Счёт "${studioName} ${suffix}" не найден. Обратитесь к администратору.` });
    }
  }

  let contractorId = null;
  if (clientName) {
    const contrRes = await db.query('SELECT id FROM contractors WHERE name = $1', [clientName]);
    if (contrRes.rows.length > 0) {
      contractorId = contrRes.rows[0].id;
      if (clientPhone || clientType) {
        const updates = [];
        const values = [];
        let paramNum = 1;
        if (clientPhone) {
          updates.push(`phone = $${paramNum++}`);
          values.push(clientPhone);
        }
        if (clientType && (clientType === 'primary' || clientType === 'regular')) {
          updates.push(`type = $${paramNum++}`);
          values.push(clientType);
        }
        values.push(contractorId);
        if (updates.length > 0) {
          await db.query(`UPDATE contractors SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramNum}`, values);
        }
      }
    } else {
      const contrType = (clientType && (clientType === 'primary' || clientType === 'regular')) ? clientType : 'customer';
      const newContr = await db.query(
        'INSERT INTO contractors (name, phone, type, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id',
        [clientName, clientPhone || '', contrType]
      );
      contractorId = newContr.rows[0].id;
    }
  }

  try {
    const ycDataVal = yclientsData ? JSON.stringify(yclientsData) : null;
    const effectivePaymentType = isVisitOnly ? 'visit_only' : paymentType;
    const isBackdate = effectiveDate !== getMoscowToday();
    const createdAtClause = isBackdate ? `'${effectiveDate} 23:59:00+03'::timestamptz` : 'NOW()';
    const result = await db.query(
      `INSERT INTO master_incomes (user_id, studio_id, amount, payment_type, category_id, client_name, client_phone, client_type, description, account_id, yclients_data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ${createdAtClause}) RETURNING *`,
      [master.id, studioId, isVisitOnly ? 0 : amount, effectivePaymentType, categoryId || null, clientName || '', clientPhone || '', clientType || 'primary', description || '', accountId, ycDataVal]
    );

    const mi = result.rows[0];
    let yclientsResult = null;

    if (!isVisitOnly) {
      const useExtId = await hasExternalIdColumn();
      const extCols = useExtId ? ['external_id'] : [];
      const extVals = useExtId ? [`mi-${mi.id}`] : [];

      const txDate = effectiveDate;
      const calculatedCreditDate = await autoCalculateCreditDate(txDate, accountId, categoryId, studioId);

      const settlementAccountId = await resolveSettlementAccount(accountId, categoryId, studioId);

      const baseCols = ['date', 'amount', 'type', 'account_id', 'studio_id', 'category_id', 'description', 'confirmed', 'contractor_id', 'client_type', 'credit_date', 'settlement_account_id'];
      const paymentLabel = PAYMENT_TYPE_SUFFIXES[paymentType] || paymentType;
      const baseVals = [
        txDate, 
        amount, 
        'income', 
        accountId, 
        studioId, 
        categoryId || null,
        `${paymentLabel}${description ? ' | ' + description : ''}`, 
        false,
        contractorId,
        clientType || 'primary',
        calculatedCreditDate,
        settlementAccountId
      ];

      const allCols = [...baseCols, ...extCols];
      const allVals = [...baseVals, ...extVals];
      const placeholders = allVals.map((_, i) => `$${i + 1}`).join(', ');

      console.log('Inserting transaction for master income:', { allCols, allVals });

      const txResult = await db.query(
        `INSERT INTO transactions (${allCols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
        allVals
      );
      const txId = txResult.rows[0].id;

      try {
        const { verifyTransaction } = require('../services/yclients.cjs');
        yclientsResult = await verifyTransaction(txId);
      } catch (ycErr) {
        console.error('YClients verification failed during creation:', ycErr);
      }
    }

    const paymentLabel = isVisitOnly ? 'Визит (0₽)' : (PAYMENT_TYPE_SUFFIXES[paymentType] || paymentType);
    await logAction(master.id, 'create', 'master_income', mi.id, {
      amount: parseFloat(isVisitOnly ? '0' : amount),
      paymentType: paymentLabel,
      clientName: clientName || '',
    });

    res.json({ ...toCamelCase(mi), yclientsResult });
  } catch (err) {
    console.error('Error creating master income:', err);
    res.status(500).json({ error: 'Error creating master income: ' + err.message });
  }
});

router.put('/master-incomes/:id', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;
  const { id } = req.params;
  const { amount, paymentType, categoryId, clientName, clientType, description } = req.body;
  const clientPhone = normalizePhone(req.body.clientPhone);

  try {
    const oldRes = await db.query('SELECT * FROM master_incomes WHERE id = $1 AND user_id = $2', [id, master.id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    const old = oldRes.rows[0];
    
    // Check if created today
    const createdDate = require('../utils/moscow.cjs').toMoscowDateString(old.created_at);
    const todayDate = getMoscowToday();
    if (createdDate !== todayDate) return res.status(403).json({ error: 'Можно редактировать только записи за сегодня' });

    const accountId = await resolveAccountId(master.studio_id, paymentType);
    if (!accountId) return res.status(400).json({ error: 'Account not found for payment type' });

    let contractorId = null;
    if (clientName) {
      const contrRes = await db.query('SELECT id FROM contractors WHERE name = $1', [clientName]);
      if (contrRes.rows.length > 0) {
        contractorId = contrRes.rows[0].id;
        if (clientPhone || clientType) {
          const updates = [];
          const values = [];
          let paramNum = 1;
          if (clientPhone) {
            updates.push(`phone = $${paramNum++}`);
            values.push(clientPhone);
          }
          if (clientType && (clientType === 'primary' || clientType === 'regular')) {
            updates.push(`type = $${paramNum++}`);
            values.push(clientType);
          }
          values.push(contractorId);
          if (updates.length > 0) {
            await db.query(`UPDATE contractors SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramNum}`, values);
          }
        }
      } else {
        const contrType = (clientType && (clientType === 'primary' || clientType === 'regular')) ? clientType : 'customer';
        const newContr = await db.query('INSERT INTO contractors (name, phone, type, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id', [clientName, clientPhone || '', contrType]);
        contractorId = newContr.rows[0].id;
      }
    }

    const result = await db.query(
      `UPDATE master_incomes 
       SET amount=$1, payment_type=$2, category_id=$3, client_name=$4, client_phone=$5, client_type=$6, description=$7, account_id=$8
       WHERE id=$9 RETURNING *`,
      [amount, paymentType, categoryId || null, clientName || '', clientPhone || '', clientType || 'primary', description || '', accountId, id]
    );

    const paymentLabel = PAYMENT_TYPE_SUFFIXES[paymentType] || paymentType;
    await db.query(
      `UPDATE transactions 
       SET amount=$1, account_id=$2, category_id=$3, description=$4, contractor_id=$5, client_type=$6
       WHERE external_id=$7`,
      [amount, accountId, categoryId || null, `${paymentLabel}${description ? ' | ' + description : ''}`, contractorId, clientType || 'primary', `mi-${id}`]
    );

    // Re-verify with YClients after update
    let yclientsResult = null;
    try {
      const txRes = await db.query('SELECT id FROM transactions WHERE external_id = $1', [`mi-${id}`]);
      if (txRes.rows.length > 0) {
        const { verifyTransaction } = require('../services/yclients.cjs');
        yclientsResult = await verifyTransaction(txRes.rows[0].id);
      }
    } catch (ycErr) {
      console.error('YClients verification failed during update:', ycErr);
    }

    await logAction(master.id, 'update', 'master_income', id, { amount: parseFloat(amount) });
    res.json({ ...toCamelCase(result.rows[0]), yclientsResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating master income' });
  }
});

router.delete('/master-incomes/:id', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;
  const { id } = req.params;

  try {
    const oldRes = await db.query('SELECT * FROM master_incomes WHERE id = $1 AND user_id = $2', [id, master.id]);
    if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    const old = oldRes.rows[0];

    const createdDate = require('../utils/moscow.cjs').toMoscowDateString(old.created_at);
    const todayDate = getMoscowToday();
    if (createdDate !== todayDate) return res.status(403).json({ error: 'Можно удалять только записи за сегодня' });

    await db.query('DELETE FROM master_incomes WHERE id = $1', [id]);
    await db.query('DELETE FROM transactions WHERE external_id = $1', [`mi-${id}`]);

    await logAction(master.id, 'delete', 'master_income', id, `Deleted income ${old.amount}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting master income' });
  }
});

// ============================================================
// Shift close (Сдать смену)
// ============================================================

router.get('/master-incomes/today-totals', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;
  try {
    const today = getMoscowToday();
    const result = await db.query(
      `SELECT payment_type, COALESCE(SUM(amount), 0) as amount, COUNT(*) as count
       FROM master_incomes
       WHERE user_id = $1
         AND DATE(created_at) = $2
         AND payment_type != 'visit_only'
       GROUP BY payment_type
       ORDER BY amount DESC`,
      [master.id, today]
    );
    const byType = {};
    let total = 0;
    for (const r of result.rows) {
      const amt = parseFloat(r.amount) || 0;
      byType[r.payment_type] = { amount: amt, count: parseInt(r.count) || 0 };
      total += amt;
    }
    const visitsRes = await db.query(
      `SELECT COUNT(DISTINCT COALESCE(yclients_data->'recordIds'->>0, yclients_data->>'visitId', id::text)) as visits
       FROM master_incomes
       WHERE user_id = $1 AND DATE(created_at) = $2`,
      [master.id, today]
    );
    const alreadyClosedRes = await db.query(
      `SELECT id, created_at, totals, cash_balance FROM master_shifts
       WHERE user_id = $1 AND shift_date = $2
       ORDER BY created_at DESC LIMIT 1`,
      [master.id, today]
    );
    res.json({
      date: today,
      byType,
      total,
      visits: parseInt(visitsRes.rows[0]?.visits) || 0,
      alreadyClosed: alreadyClosedRes.rows.length > 0 ? toCamelCase(alreadyClosedRes.rows[0]) : null,
    });
  } catch (err) {
    console.error('Error fetching today totals:', err);
    res.status(500).json({ error: 'Ошибка загрузки итогов' });
  }
});

router.get('/master-incomes/cash-on-hand', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;
  try {
    const lastShiftRes = await db.query(
      `SELECT cash_balance, created_at FROM master_shifts
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [master.id]
    );
    const lastShift = lastShiftRes.rows[0] || null;
    const baseBalance = lastShift ? parseFloat(lastShift.cash_balance) || 0 : 0;
    const since = lastShift ? lastShift.created_at : new Date('1970-01-01');
    const cashSinceRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as cash_in
       FROM master_incomes
       WHERE user_id = $1 AND payment_type = 'cash' AND created_at > $2`,
      [master.id, since]
    );
    const cashSince = parseFloat(cashSinceRes.rows[0]?.cash_in) || 0;
    res.json({
      cashOnHand: baseBalance + cashSince,
      baseBalance,
      cashSinceLastShift: cashSince,
      lastShiftAt: lastShift ? lastShift.created_at : null,
    });
  } catch (err) {
    console.error('Error fetching cash on hand:', err);
    res.status(500).json({ error: 'Ошибка загрузки наличных' });
  }
});

router.post('/master-incomes/close-shift', async (req, res) => {
  const master = await requireMaster(req, res);
  if (!master) return;
  try {
    const { totals, cashBalance } = req.body || {};
    if (!totals || typeof totals !== 'object') {
      return res.status(400).json({ error: 'totals required' });
    }
    if (cashBalance === undefined || cashBalance === null || isNaN(parseFloat(cashBalance))) {
      return res.status(400).json({ error: 'cashBalance required' });
    }

    const cleanTotals = {};
    for (const [k, v] of Object.entries(totals)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0) cleanTotals[k] = n;
    }
    const cb = parseFloat(cashBalance);
    const today = getMoscowToday();

    // Compute server-side totals for audit
    const computedRes = await db.query(
      `SELECT payment_type, COALESCE(SUM(amount), 0) as amount
       FROM master_incomes
       WHERE user_id = $1 AND DATE(created_at) = $2 AND payment_type != 'visit_only'
       GROUP BY payment_type`,
      [master.id, today]
    );
    const computed = {};
    for (const r of computedRes.rows) computed[r.payment_type] = parseFloat(r.amount) || 0;

    // Studio + master info
    const masterInfoRes = await db.query(
      `SELECT u.id, u.username, u.studio_id, s.name as studio_name
       FROM users u LEFT JOIN studios s ON u.studio_id = s.id
       WHERE u.id = $1`,
      [master.id]
    );
    const info = masterInfoRes.rows[0] || {};

    const insertRes = await db.query(
      `INSERT INTO master_shifts (user_id, studio_id, shift_date, totals, computed_totals, cash_balance)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [master.id, info.studio_id || null, today, JSON.stringify(cleanTotals), JSON.stringify(computed), cb]
    );
    const shiftId = insertRes.rows[0].id;
    const createdAt = insertRes.rows[0].created_at;

    const totalReported = Object.values(cleanTotals).reduce((a, b) => a + b, 0);
    const totalComputed = Object.values(computed).reduce((a, b) => a + b, 0);

    const payload = {
      event: 'shift_closed',
      shiftId,
      date: today,
      createdAt,
      master: { id: info.id, username: info.username },
      studio: { id: info.studio_id, name: info.studio_name },
      totals: cleanTotals,
      computedTotals: computed,
      totalReported,
      totalComputed,
      mismatch: Math.abs(totalReported - totalComputed) > 0.01,
      cashBalance: cb,
    };

    let webhookStatus = 'pending';
    let webhookResponse = null;
    const webhookUrl = process.env.SHIFT_CLOSE_WEBHOOK_URL || 'https://entize.tw1.ru/webhook/shift';
    try {
      const r = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      webhookStatus = r.ok ? 'ok' : `error_${r.status}`;
      webhookResponse = (await r.text().catch(() => '')).slice(0, 500);
    } catch (e) {
      webhookStatus = 'failed';
      webhookResponse = String(e && e.message || e).slice(0, 500);
    }

    await db.query(
      `UPDATE master_shifts SET webhook_status = $1, webhook_response = $2 WHERE id = $3`,
      [webhookStatus, webhookResponse, shiftId]
    );

    try {
      await logAction(master.id, info.username || 'master', 'create', 'master_shift', shiftId,
        `Сдана смена за ${today} · итого ${totalReported} ₽ · остаток наличных ${cb} ₽`);
    } catch {}

    res.json({ success: true, shiftId, webhookStatus, payload });
  } catch (err) {
    console.error('Error closing shift:', err);
    res.status(500).json({ error: 'Ошибка при закрытии смены' });
  }
});

module.exports = router;
