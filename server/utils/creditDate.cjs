const db = require('../db.cjs');

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function calculateCreditDate(txDate, delayDays, weekendRule, dayDelays) {
  const d = new Date(txDate);
  const txDayOfWeek = d.getDay();
  const txDayName = DAY_NAMES[txDayOfWeek];

  const delays = typeof dayDelays === 'string' ? JSON.parse(dayDelays || '{}') : (dayDelays || {});
  const effectiveDelay = (delays && delays[txDayName] !== undefined && delays[txDayName] !== null && delays[txDayName] !== '')
    ? parseInt(delays[txDayName])
    : delayDays;

  d.setDate(d.getDate() + effectiveDelay);

  const dayOfWeek = d.getDay();
  switch (weekendRule) {
    case 'next_business_day':
      if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
      else if (dayOfWeek === 6) d.setDate(d.getDate() + 2);
      break;
    case 'saturday_ok':
      if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
      break;
    case 'previous_business_day':
      if (dayOfWeek === 0) d.setDate(d.getDate() - 2);
      else if (dayOfWeek === 6) d.setDate(d.getDate() - 1);
      break;
    case 'no_adjustment':
      break;
    default:
      if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
      else if (dayOfWeek === 6) d.setDate(d.getDate() + 2);
      break;
  }

  return d.toISOString().split('T')[0];
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
    return calculateCreditDate(txDate, rule.delay_days, rule.weekend_rule, rule.day_delays);
  } catch (err) {
    console.error('Error auto-calculating credit date:', err);
    return null;
  }
}

module.exports = { calculateCreditDate, autoCalculateCreditDate };
