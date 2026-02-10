const db = require('../db.cjs');

const logAction = async (userId, action, entityType, entityId, details) => {
  try {
    // Fetch username for denormalization (easier display)
    let username = 'Unknown';
    if (userId) {
        const u = await db.query("SELECT username FROM users WHERE id = $1", [userId]);
        if (u.rows.length > 0) username = u.rows[0].username;
    }

    await db.query(
      "INSERT INTO activity_logs (user_id, username, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)",
      [userId || null, username, action, entityType, entityId?.toString(), typeof details === 'object' ? JSON.stringify(details) : details]
    );
  } catch (err) {
    console.error("Logging error:", err);
  }
};

module.exports = { logAction };