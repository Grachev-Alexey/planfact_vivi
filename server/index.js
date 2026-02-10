const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- GET INITIAL DATA ---
app.get('/api/init', async (req, res) => {
  try {
    const [transactions, accounts, categories, studios] = await Promise.all([
      db.query('SELECT * FROM transactions ORDER BY date DESC'),
      db.query('SELECT * FROM accounts ORDER BY name'),
      db.query('SELECT * FROM categories ORDER BY name'),
      db.query('SELECT * FROM studios ORDER BY name')
    ]);

    res.json({
      transactions: transactions.rows,
      accounts: accounts.rows,
      categories: categories.rows,
      studios: studios.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- TRANSACTIONS ---

// Create
app.post('/api/transactions', async (req, res) => {
  const { date, amount, type, accountId, categoryId, studioId, description, contractor } = req.body;
  
  try {
    const result = await db.query(
      `INSERT INTO transactions (date, amount, type, account_id, category_id, studio_id, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [date, amount, type, accountId, categoryId, studioId, description]
    );
    
    // Update account balance
    const sign = type === 'income' ? 1 : -1;
    await db.query(
      `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
      [amount * sign, accountId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating transaction' });
  }
});

// Delete
app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get transaction first to revert balance
    const txRes = await db.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    
    const tx = txRes.rows[0];
    
    // Delete transaction
    await db.query('DELETE FROM transactions WHERE id = $1', [id]);
    
    // Revert balance
    const sign = tx.type === 'income' ? -1 : 1; // Invert sign to revert
    await db.query(
      `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
      [Number(tx.amount) * sign, tx.account_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting transaction' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
