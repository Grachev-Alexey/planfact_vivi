const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

const entityLabels = {
  categories: 'Статья',
  contractors: 'Контрагент',
  accounts: 'Счет',
  studios: 'Студия',
  legal_entities: 'Юрлицо'
};

const fieldLabels = {
  name: 'название',
  type: 'тип',
  parentId: 'родительская статья',
  parent_id: 'родительская статья',
  inn: 'ИНН',
  phone: 'телефон',
  kpp: 'КПП',
  description: 'описание',
  address: 'адрес',
  color: 'цвет',
  currency: 'валюта',
  initialBalance: 'начальный остаток',
  initial_balance: 'начальный остаток',
  legalEntityId: 'юрлицо',
  legal_entity_id: 'юрлицо',
  icon: 'иконка',
  allowedPaymentTypes: 'доступные типы оплат',
  allowed_payment_types: 'доступные типы оплат',
  bankApiKey: 'API ключ банка',
  bank_api_key: 'API ключ банка',
  bankType: 'тип банка',
  bank_type: 'тип банка'
};

const accountTypeLabels = { cash: 'наличные', card: 'карта', account: 'счет' };
const categoryTypeLabels = { income: 'доход', expense: 'расход' };

const formatFieldValue = async (field, value) => {
  if (value === null || value === undefined || value === '') return '—';
  const dbField = field.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
  if (dbField === 'type' || field === 'type') {
    return accountTypeLabels[value] || categoryTypeLabels[value] || value;
  }
  if (dbField === 'legal_entity_id' || field === 'legalEntityId') {
    try {
      const r = await db.query('SELECT name FROM legal_entities WHERE id=$1', [value]);
      return r.rows[0]?.name || value;
    } catch { return value; }
  }
  if (dbField === 'parent_id' || field === 'parentId') {
    try {
      const r = await db.query('SELECT name FROM categories WHERE id=$1', [value]);
      return r.rows[0]?.name || value;
    } catch { return value; }
  }
  if (dbField === 'bank_api_key' || field === 'bankApiKey') {
    return value ? '***' : '—';
  }
  return String(value);
};

const describeItem = async (tableName, item) => {
  const label = (entityLabels[tableName] || tableName).toLowerCase();
  const parts = [item.name];

  if (tableName === 'accounts') {
    if (item.type) parts.push(accountTypeLabels[item.type] || item.type);
    if (item.currency && item.currency !== 'RUB') parts.push(item.currency);
    if (item.legal_entity_id) {
      try {
        const r = await db.query('SELECT name FROM legal_entities WHERE id=$1', [item.legal_entity_id]);
        if (r.rows[0]) parts.push(`юрлицо: ${r.rows[0].name}`);
      } catch {}
    }
  } else if (tableName === 'categories') {
    if (item.type) parts.push(categoryTypeLabels[item.type] || item.type);
    if (item.parent_id) {
      try {
        const r = await db.query('SELECT name FROM categories WHERE id=$1', [item.parent_id]);
        if (r.rows[0]) parts.push(`в: ${r.rows[0].name}`);
      } catch {}
    }
  } else if (tableName === 'contractors') {
    if (item.inn) parts.push(`ИНН: ${item.inn}`);
    if (item.phone) parts.push(`тел: ${item.phone}`);
  } else if (tableName === 'legal_entities') {
    if (item.inn) parts.push(`ИНН: ${item.inn}`);
    if (item.kpp) parts.push(`КПП: ${item.kpp}`);
  } else if (tableName === 'studios') {
    if (item.address) parts.push(item.address);
  }

  return parts.join(', ');
};

const createCrudHandlers = (tableName, fields) => {
  router.post(`/${tableName}`, async (req, res) => {
    const currentUserId = req.headers['x-user-id'];
    try {
      const keys = Object.keys(req.body).filter(k => fields.includes(k));
      const values = keys.map(k => req.body[k]);
      
      const query = `INSERT INTO ${tableName} (${keys.map(k => k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      const result = await db.query(query, values);
      
      const newItem = result.rows[0];
      const label = (entityLabels[tableName] || tableName).toLowerCase();
      const desc = await describeItem(tableName, newItem);
      await logAction(currentUserId, 'create', tableName, newItem.id, `Создан(а) ${label}: ${desc}`);
      res.json(toCamelCase(newItem));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Creation failed' });
    }
  });

  router.put(`/${tableName}/:id`, async (req, res) => {
    const currentUserId = req.headers['x-user-id'];
    try {
      const keys = Object.keys(req.body).filter(k => fields.includes(k));
      if (keys.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const oldRes = await db.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      if (oldRes.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
      const old = oldRes.rows[0];

      const setClauses = keys.map((k, i) => `${k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = $${i + 1}`);
      const values = keys.map(k => req.body[k]);
      values.push(req.params.id);

      const query = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`;
      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const updatedItem = result.rows[0];
      const label = (entityLabels[tableName] || tableName).toLowerCase();

      const changes = [];
      for (const key of keys) {
        const dbKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
        const oldVal = old[dbKey];
        const newVal = req.body[key];
        const normalizeVal = v => (v === null || v === undefined || v === '') ? null : String(v);
        if (normalizeVal(oldVal) !== normalizeVal(newVal)) {
          const fieldLabel = fieldLabels[key] || fieldLabels[dbKey] || key;
          const oldFormatted = await formatFieldValue(key, oldVal);
          const newFormatted = await formatFieldValue(key, newVal);
          changes.push(`${fieldLabel}: ${oldFormatted} → ${newFormatted}`);
        }
      }

      let detail;
      if (changes.length > 0) {
        detail = `Изменен(а) ${label} «${old.name}». Изменения: ${changes.join('; ')}`;
      } else {
        detail = `Изменен(а) ${label} «${old.name}» (без изменений)`;
      }

      await logAction(currentUserId, 'update', tableName, updatedItem.id, detail);
      res.json(toCamelCase(updatedItem));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  router.delete(`/${tableName}/:id`, async (req, res) => {
    const currentUserId = req.headers['x-user-id'];
    try {
      const oldRes = await db.query(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
      const label = (entityLabels[tableName] || tableName).toLowerCase();
      let detail;
      if (oldRes.rows.length > 0) {
        const desc = await describeItem(tableName, oldRes.rows[0]);
        detail = `Удален(а) ${label}: ${desc}`;
      } else {
        detail = `Удален(а) ${label}`;
      }
      await db.query(`DELETE FROM ${tableName} WHERE id = $1`, [req.params.id]);
      await logAction(currentUserId, 'delete', tableName, req.params.id, detail);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Deletion failed' });
    }
  });
};

createCrudHandlers('categories', ['name', 'type', 'parentId', 'icon']);
createCrudHandlers('contractors', ['name', 'inn', 'phone', 'description']);
createCrudHandlers('accounts', ['name', 'type', 'currency', 'initialBalance', 'legalEntityId', 'studioId', 'bankApiKey', 'bankType']);
createCrudHandlers('studios', ['name', 'address', 'color', 'allowedPaymentTypes']);
createCrudHandlers('legal_entities', ['name', 'inn', 'kpp', 'address', 'description']);

module.exports = router;
