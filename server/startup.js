const db = require('./db');

const initDB = async () => {
  try {
    // Users Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Activity Logs Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Check if admin exists
    const adminCheck = await db.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", ['admin', 'admin', 'admin']);
      console.log("Default admin user created (admin/admin)");
    }
    
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("DB Init Error:", err);
  }
};

module.exports = initDB;