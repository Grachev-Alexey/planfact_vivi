const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

const createCrudHandlers = (tableName, fields) => {
  // Create Item
  router.post(`/${tableName}`, async (req, res) => {
    const currentUserId = req.headers['x-user-id'];
    try {
      const keys = Object.keys(req.body).filter(k => fields.includes(k));
      const values = keys.map(k => req.body[k]);
      
      const query = `INSERT INTO ${tableName} (${keys.map(k => k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
      const result = await db.query(query, values);
      
      const newItem = result.rows[0];
      await logAction(currentUserId, 'create', tableName, newItem.id, { name: newItem.name });
      res.json(toCamelCase(newItem));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Creation failed' });
    }
  });

  // Update Item
  router.put(`/${tableName}/:id`, async (req, res) => {
    const currentUserId = req.headers['x-user-id'];
    try {
      const keys = Object.keys(req.body).filter(k => fields.includes(k));
      if (keys.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      const setClauses = keys.map((k, i) => `${k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)} = $${i + 1}`);
      const values = keys.map(k => req.body[k]);
      values.push(req.params.id);

      const query = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`;
      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const updatedItem = result.rows[0];
      await logAction(currentUserId, 'update', tableName, updatedItem.id, { name: updatedItem.name });
      res.json(toCamelCase(updatedItem));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  // Delete Item
  router.delete(`/${tableName}/:id`, async (req, res) => {
    const currentUserId = req.headers['x-user-id'];
    try {
      const itemRes = await db.query(`SELECT name FROM ${tableName} WHERE id = $1`, [req.params.id]);
      const itemName = itemRes.rows.length > 0 ? itemRes.rows[0].name : '';
      await db.query(`DELETE FROM ${tableName} WHERE id = $1`, [req.params.id]);
      await logAction(currentUserId, 'delete', tableName, req.params.id, { name: itemName });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Deletion failed' });
    }
  });
};

createCrudHandlers('categories', ['name', 'type', 'parentId', 'icon']);
createCrudHandlers('contractors', ['name', 'inn', 'description']);
createCrudHandlers('accounts', ['name', 'type', 'currency', 'initialBalance', 'legalEntityId']);
createCrudHandlers('studios', ['name', 'address', 'color']);
createCrudHandlers('legal_entities', ['name', 'inn', 'kpp', 'address', 'description']);

module.exports = router;