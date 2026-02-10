const express = require('express');
const router = express.Router();
const db = require('../db');
const { toCamelCase } = require('../utils/helpers');
const { logAction } = require('../utils/logger');

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1 AND password = $2", [username, password]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      await logAction(user.id, 'login', 'auth', null, 'User logged in');
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
    const result = await db.query("SELECT id, username, role, created_at FROM users ORDER BY id");
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    res.status(500).json({ error: 'Error fetching users' });
  }
});

// Create User
router.post('/users', async (req, res) => {
  const { username, password, role, currentUserId } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, password, role || 'user']
    );
    const newUser = result.rows[0];
    await logAction(currentUserId, 'create', 'user', newUser.id, `Created user ${username}`);
    res.json(toCamelCase(newUser));
  } catch (err) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Delete User
router.delete('/users/:id', async (req, res) => {
  const currentUserId = req.headers['x-user-id'];
  try {
    await db.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    await logAction(currentUserId, 'delete', 'user', req.params.id, 'Deleted user');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// Get Logs
router.get('/logs', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200");
    res.json(result.rows.map(toCamelCase));
  } catch (err) {
    res.status(500).json({ error: 'Error fetching logs' });
  }
});

module.exports = router;