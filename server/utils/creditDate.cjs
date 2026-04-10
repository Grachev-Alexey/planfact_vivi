const db = require('../db.cjs');

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

let holidayCache = { dates: new Set(), ts: 0 };
const CACHE_TTL = 5 * 60 * 1000;

async function loadHolidays() {
  const now = Date.now();
  if (now - holidayCache.ts < CACHE_TTL && holidayCache.dates.size > 0) {
    return holidayCache.dates;
  }
  try {
    const result = await db.query('SELECT date FROM holidays WHERE affects_credit = true');
    const dates = new Set();
    for (const row of result.rows) {
      const d = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0];
      dates.add(d);
    }
    holidayCache = { dates, ts: now };
    return dates;
  } catch (err) {
    console.error('Error loading holidays:', err);
    return holidayCache.dates;
  }
}

function clearHolidayCache() {
  holidayCache = { dates: new Set(), ts: 0 };
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isNonWorkingDay(d, holidays) {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return true;
  if (holidays && holidays.has(fmtDate(d))) return true;
  return false;
}

function calculateCreditDate(txDate, delayDays, weekendRule, dayDelays, holidays) {
  const d = new Date(txDate);
  const txDayOfWeek = d.getDay();
  const txDayName = DAY_NAMES[txDayOfWeek];

  const delays = typeof dayDelays === 'string' ? JSON.parse(dayDelays || '{}') : (dayDelays || {});
  const effectiveDelay = (delays && delays[txDayName] !== undefined && delays[txDayName] !== null && delays[txDayName] !== '')
    ? parseInt(delays[txDayName])
    : delayDays;

  d.setDate(d.getDate() + effectiveDelay);

  const holidaySet = holidays || null;

  switch (weekendRule) {
    case 'next_business_day':
      while (isNonWorkingDay(d, holidaySet)) {
        d.setDate(d.getDate() + 1);
      }
      break;
    case 'saturday_ok': {
      const dow = d.getDay();
      if (dow === 0 || (holidaySet && holidaySet.has(fmtDate(d)))) {
        d.setDate(d.getDate() + 1);
        while (isNonWorkingDay(d, holidaySet)) {
          d.setDate(d.getDate() + 1);
        }
      }
      break;
    }
    case 'previous_business_day':
      while (isNonWorkingDay(d, holidaySet)) {
        d.setDate(d.getDate() - 1);
      }
      break;
    case 'no_adjustment':
      break;
    default:
      while (isNonWorkingDay(d, holidaySet)) {
        d.setDate(d.getDate() + 1);
      }
      break;
  }

  return fmtDate(d);
}

async function autoCalculateCreditDate(txDate, accountId, categoryId, studioId) {
  if (!accountId || !txDate) return null;

  try {
    const params = [accountId];
    let catParam = '', studioParam = '';
    if (categoryId) {
      params.push(categoryId);
      catParam = '$' + params.length;
    }
    if (studioId) {
      params.push(studioId);
      studioParam = '$' + params.length;
    }

    let query = `SELECT *, 
      CASE 
        WHEN category_id IS NOT NULL AND studio_id IS NOT NULL THEN 4
        WHEN category_id IS NOT NULL THEN 3
        WHEN studio_id IS NOT NULL THEN 2
        ELSE 1
      END as specificity
      FROM credit_date_rules WHERE account_id = $1 AND enabled = true
      AND (category_id IS NULL${catParam ? ` OR category_id = ${catParam}` : ''})
      AND (studio_id IS NULL${studioParam ? ` OR studio_id = ${studioParam}` : ''})
      ORDER BY specificity DESC LIMIT 1`;

    const ruleRes = await db.query(query, params);
    if (ruleRes.rows.length === 0) return null;

    const rule = ruleRes.rows[0];
    const holidays = await loadHolidays();
    return calculateCreditDate(txDate, rule.delay_days, rule.weekend_rule, rule.day_delays, holidays);
  } catch (err) {
    console.error('Error auto-calculating credit date:', err);
    return null;
  }
}

async function resolveSettlementAccount(accountId, categoryId, studioId) {
  if (!accountId) return null;
  try {
    const params = [accountId];
    let catParam = '', studioParam = '';
    if (categoryId) {
      params.push(categoryId);
      catParam = '$' + params.length;
    }
    if (studioId) {
      params.push(studioId);
      studioParam = '$' + params.length;
    }
    const query = `SELECT settlement_account_id,
      CASE
        WHEN category_id IS NOT NULL AND studio_id IS NOT NULL THEN 4
        WHEN category_id IS NOT NULL THEN 3
        WHEN studio_id IS NOT NULL THEN 2
        ELSE 1
      END as specificity
      FROM settlement_rules WHERE account_id = $1 AND enabled = true
      AND (category_id IS NULL${catParam ? ` OR category_id = ${catParam}` : ''})
      AND (studio_id IS NULL${studioParam ? ` OR studio_id = ${studioParam}` : ''})
      ORDER BY specificity DESC LIMIT 1`;
    const res = await db.query(query, params);
    return res.rows.length > 0 ? res.rows[0].settlement_account_id : null;
  } catch (err) {
    console.error('Error resolving settlement account:', err);
    return null;
  }
}

module.exports = { calculateCreditDate, autoCalculateCreditDate, loadHolidays, clearHolidayCache, resolveSettlementAccount };
