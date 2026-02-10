require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initDB = require('./startup');

// Route Imports
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const dictionaryRoutes = require('./routes/dictionaries');
const initialDataRoutes = require('./routes/initialData');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize DB
initDB();

// Mount Routes
app.use('/api', authRoutes);
app.use('/api', transactionRoutes);
app.use('/api', dictionaryRoutes);
app.use('/api', initialDataRoutes);

app.listen(PORT, () => {
  console.log(`ViVi Finance Server running on http://localhost:${PORT}`);
});