require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initDB = require('./startup.cjs');

const authRoutes = require('./routes/auth.cjs');
const transactionRoutes = require('./routes/transactions.cjs');
const dictionaryRoutes = require('./routes/dictionaries.cjs');
const initialDataRoutes = require('./routes/initialData.cjs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

initDB();

app.use('/api', authRoutes);
app.use('/api', transactionRoutes);
app.use('/api', dictionaryRoutes);
app.use('/api', initialDataRoutes);

app.listen(PORT, 'localhost', () => {
  console.log(`ViVi Finance Server running on http://localhost:${PORT}`);
});
