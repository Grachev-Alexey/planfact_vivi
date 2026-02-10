const express = require('express');
const router = express.Router();
const db = require('../db');
const { toCamelCase } = require('../utils/helpers');
const { logAction } = require('../utils/logger');

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
      await logAction(currentUserId, 'create', tableName, newItem.id, `Created item in ${tableName}`);
      res.json(toCamelCase(newItem));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Creation failed' });
    }
  });

  // Delete Item
  router.delete(`/${tableName}/:id`, async (req, res) => {
    const currentUserId = req.headers['x-user-id'];
    try {
      await db.query(`DELETE FROM ${tableName} WHERE id = $1`, [req.params.id]);
      await logAction(currentUserId, 'delete', tableName, req.params.id, `Deleted from ${tableName}`);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Deletion failed' });
    }
  });
};

createCrudHandlers('categories', ['name', 'type', 'parentId', 'icon']);
createCrudHandlers('contractors', ['name', 'inn', 'description']);
createCrudHandlers('projects', ['name', 'description']);
createCrudHandlers('accounts', ['name', 'type', 'currency', 'initialBalance']);
createCrudHandlers('studios', ['name', 'address', 'color']);

module.exports = router;