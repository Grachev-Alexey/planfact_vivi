const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

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
        COUNT(DISTINCT mi.client_phone) FILTER (WHERE mi.client_phone != '') as unique_clients,
        COALESCE(SUM(mi.amount) FILTER (WHERE mi.client_type = 'primary'), 0) as primary_amount,
        COALESCE(SUM(mi.amount) FILTER (WHERE mi.client_type = 'regular'), 0) as regular_amount,
        COUNT(*) FILTER (WHERE mi.client_type = 'primary') as primary_count,
        COUNT(*) FILTER (WHERE mi.client_type = 'regular') as regular_count
      FROM master_incomes mi ${baseWhere}`,
      params
    );

    const visitCountRes = await db.query(
      `SELECT 
        COUNT(DISTINCT COALESCE(mi.yclients_data->>'visitId', mi.yclients_data->'recordIds'->>0, mi.id::text)) as total_visits,
        COUNT(DISTINCT COALESCE(mi.yclients_data->>'visitId', mi.yclients_data->'recordIds'->>0, mi.id::text)) FILTER (WHERE mi.payment_type = 'visit_only') as zero_visits
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

    const summary = summaryRes.rows[0];
    const vcRow = visitCountRes.rows[0];
    const totalEntries = parseInt(summary.total_entries) || 0;
    const totalAmount = parseFloat(summary.total_amount) || 0;

    res.json({
      summary: {
        totalAmount,
        totalEntries,
        uniqueClients: parseInt(summary.unique_clients) || 0,
        avgCheck: totalEntries > 0 ? Math.round(totalAmount / totalEntries) : 0,
        primaryAmount: parseFloat(summary.primary_amount) || 0,
        regularAmount: parseFloat(summary.regular_amount) || 0,
        primaryCount: parseInt(summary.primary_count) || 0,
        regularCount: parseInt(summary.regular_count) || 0,
        totalVisits: parseInt(vcRow.total_visits) || 0,
        zeroVisits: parseInt(vcRow.zero_visits) || 0,
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

  const { amount, paymentType, categoryId, clientName, clientType, description, yclientsData, visitOnly } = req.body;
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
    const result = await db.query(
      `INSERT INTO master_incomes (user_id, studio_id, amount, payment_type, category_id, client_name, client_phone, client_type, description, account_id, yclients_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [master.id, studioId, isVisitOnly ? 0 : amount, effectivePaymentType, categoryId || null, clientName || '', clientPhone || '', clientType || 'primary', description || '', accountId, ycDataVal]
    );

    const mi = result.rows[0];
    let yclientsResult = null;

    if (!isVisitOnly) {
      const useExtId = await hasExternalIdColumn();
      const extCols = useExtId ? ['external_id'] : [];
      const extVals = useExtId ? [`mi-${mi.id}`] : [];

      const baseCols = ['date', 'amount', 'type', 'account_id', 'studio_id', 'category_id', 'description', 'confirmed', 'contractor_id', 'client_type'];
      const paymentLabel = PAYMENT_TYPE_SUFFIXES[paymentType] || paymentType;
      const baseVals = [
        new Date().toISOString().split('T')[0], 
        amount, 
        'income', 
        accountId, 
        studioId, 
        categoryId || null,
        `${paymentLabel}${description ? ' | ' + description : ''}`, 
        false,
        contractorId,
        clientType || 'primary'
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
    const createdDate = new Date(old.created_at).toISOString().split('T')[0];
    const todayDate = new Date().toISOString().split('T')[0];
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

    const createdDate = new Date(old.created_at).toISOString().split('T')[0];
    const todayDate = new Date().toISOString().split('T')[0];
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

module.exports = router;
