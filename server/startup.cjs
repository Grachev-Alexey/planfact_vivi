const db = require('./db.cjs');

const initDB = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

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

    await db.query(`
      CREATE TABLE IF NOT EXISTS legal_entities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        inn TEXT,
        kpp TEXT,
        address TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'cash',
        currency TEXT DEFAULT 'RUB',
        initial_balance NUMERIC(15,2) DEFAULT 0,
        legal_entity_id INTEGER REFERENCES legal_entities(id),
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        parent_id INTEGER,
        icon TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS studios (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        color TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS contractors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        inn TEXT,
        type TEXT DEFAULT 'customer',
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contractors' AND column_name='phone') THEN
          ALTER TABLE contractors ADD COLUMN phone TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contractors' AND column_name='type') THEN
          ALTER TABLE contractors ADD COLUMN type TEXT DEFAULT 'customer';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contractors' AND column_name='updated_at') THEN
          ALTER TABLE contractors ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
      END $$;
    `);

    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='studios' AND column_name='yclients_id') THEN
          ALTER TABLE studios ADD COLUMN yclients_id TEXT;
        END IF;
      END $$;
    `);

    // Add legal_entity_id to accounts if not exists
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='legal_entity_id') THEN
          ALTER TABLE accounts ADD COLUMN legal_entity_id INTEGER REFERENCES legal_entities(id);
        END IF;
      END $$;
    `);

    await db.query(`ALTER TABLE IF EXISTS transactions DROP COLUMN IF EXISTS project_id`);
    await db.query(`DROP TABLE IF EXISTS projects`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        type TEXT NOT NULL,
        account_id INTEGER REFERENCES accounts(id),
        to_account_id INTEGER REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id),
        studio_id INTEGER REFERENCES studios(id),
        contractor_id INTEGER REFERENCES contractors(id),
        description TEXT DEFAULT '',
        confirmed BOOLEAN DEFAULT false,
        accrual_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='confirmed') THEN
          ALTER TABLE transactions ADD COLUMN confirmed BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='accrual_date') THEN
          ALTER TABLE transactions ADD COLUMN accrual_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='client_type') THEN
          ALTER TABLE transactions ADD COLUMN client_type TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='yclients_status') THEN
          ALTER TABLE transactions ADD COLUMN yclients_status TEXT DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='yclients_record_id') THEN
          ALTER TABLE transactions ADD COLUMN yclients_record_id TEXT DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='yclients_data') THEN
          ALTER TABLE transactions ADD COLUMN yclients_data TEXT DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='yclients_checked_at') THEN
          ALTER TABLE transactions ADD COLUMN yclients_checked_at TIMESTAMP DEFAULT NULL;
        END IF;
      END $$;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount NUMERIC(15,2) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        studio_id INTEGER REFERENCES studios(id),
        contractor_id INTEGER REFERENCES contractors(id),
        account_id INTEGER REFERENCES accounts(id),
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        payment_date DATE,
        accrual_date DATE,
        telegram_message_id TEXT,
        paid_amount NUMERIC(15,2),
        paid_date DATE,
        paid_comment TEXT DEFAULT '',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='payment_date') THEN
          ALTER TABLE payment_requests ADD COLUMN payment_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='accrual_date') THEN
          ALTER TABLE payment_requests ADD COLUMN accrual_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='account_id') THEN
          ALTER TABLE payment_requests ADD COLUMN account_id INTEGER REFERENCES accounts(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='telegram_message_id') THEN
          ALTER TABLE payment_requests ADD COLUMN telegram_message_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='paid_amount') THEN
          ALTER TABLE payment_requests ADD COLUMN paid_amount NUMERIC(15,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='paid_date') THEN
          ALTER TABLE payment_requests ADD COLUMN paid_date DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='paid_comment') THEN
          ALTER TABLE payment_requests ADD COLUMN paid_comment TEXT DEFAULT '';
        END IF;
      END $$;
    `);

    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='studio_id') THEN
          ALTER TABLE users ADD COLUMN studio_id INTEGER REFERENCES studios(id);
        END IF;
      END $$;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS master_incomes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        studio_id INTEGER REFERENCES studios(id),
        amount NUMERIC(15,2) NOT NULL,
        payment_type TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        client_name TEXT DEFAULT '',
        client_phone TEXT DEFAULT '',
        description TEXT DEFAULT '',
        account_id INTEGER REFERENCES accounts(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='master_incomes' AND column_name='account_id') THEN
          ALTER TABLE master_incomes ADD COLUMN account_id INTEGER REFERENCES accounts(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='master_incomes' AND column_name='client_type') THEN
          ALTER TABLE master_incomes ADD COLUMN client_type TEXT DEFAULT 'primary';
        END IF;
      END $$;
    `);

    const yclientsMapping = {
      'Екатеринбург': '1073250',
      'Новосибирск': '990785',
      'Омск': '1147984',
      'Санкт-Петербург (Пионерская)': '992493',
      'Санкт-Петербург (Садовая)': '993170',
      'Уфа': '993180',
    };
    for (const [name, ycId] of Object.entries(yclientsMapping)) {
      await db.query('UPDATE studios SET yclients_id = $1 WHERE name = $2 AND (yclients_id IS NULL OR yclients_id = $3)', [ycId, name, '']);
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    await db.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('yclients_form_config', '{"commentEnabled":false,"commentEditable":false,"fields":[]}')
      ON CONFLICT (key) DO NOTHING
    `);

    const adminCheck = await db.query("SELECT * FROM users WHERE username = 'grachev'");
    if (adminCheck.rows.length === 0) {
      await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", ['grachev', 'cd5d56a8', 'admin']);
      console.log("Default admin user created (grachev/cd5d56a8)");
    }
    
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("DB Init Error:", err);
  }
};

module.exports = initDB;
