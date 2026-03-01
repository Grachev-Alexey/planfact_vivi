const express = require('express');
const router = express.Router();
const db = require('../db.cjs');
const { toCamelCase } = require('../utils/helpers.cjs');
const { logAction } = require('../utils/logger.cjs');

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1 AND password = $2", [username, password]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json(toCamelCase(user));
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Login error' });
  }
});

// Get Users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query("SELECT id, username, role, studio_id, created_at FROM users ORDER BY id");
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Create User
router.post('/users', async (req, res) => {
  const { username, password, role, studioId, currentUserId } = req.body;
  if (role === 'master' && !studioId) {
    return res.status(400).json({ error: 'studioId required for master role' });
  }
  try {
    const result = await db.query(
      "INSERT INTO users (username, password, role, studio_id) VALUES ($1, $2, $3, $4) RETURNING id, username, role, studio_id",
      [username, password, role || 'user', role === 'master' ? studioId : null]
    );
    const newUser = result.rows[0];
    await logAction(currentUserId, 'create', 'user', newUser.id, { name: username });
    res.json(toCamelCase(newUser));
  } catch (err) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Delete User
router.delete('/users/:id', async (req, res) => {
  const currentUserId = req.headers['x-user-id'];
  try {
    const userRes = await db.query("SELECT username FROM users WHERE id = $1", [req.params.id]);
    const deletedName = userRes.rows.length > 0 ? userRes.rows[0].username : '';
    await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    await logAction(currentUserId, 'delete', 'user', req.params.id, { name: deletedName });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// Get Logs with pagination, filtering, search
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { action, entityType, search, username } = req.query;

    let where = [];
    let params = [];
    let paramIdx = 1;

    if (action) {
      where.push(`action = $${paramIdx++}`);
      params.push(action);
    }
    if (entityType) {
      where.push(`entity_type = $${paramIdx++}`);
      params.push(entityType);
    }
    if (username) {
      where.push(`username = $${paramIdx++}`);
      params.push(username);
    }
    if (search) {
      where.push(`details ILIKE $${paramIdx++}`);
      params.push(`%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM activity_logs ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataResult = await db.query(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    res.json({
      logs: dataResult.rows.map(toCamelCase),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching logs' });
  }
});

module.exports = router;