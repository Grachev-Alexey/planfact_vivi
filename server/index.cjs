require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const initDB = require('./startup.cjs');

const authRoutes = require('./routes/auth.cjs');
const transactionRoutes = require('./routes/transactions.cjs');
const dictionaryRoutes = require('./routes/dictionaries.cjs');
const initialDataRoutes = require('./routes/initialData.cjs');
const paymentRequestRoutes = require('./routes/paymentRequests.cjs');
const masterIncomeRoutes = require('./routes/masterIncomes.cjs');
const yclientsRoutes = require('./routes/yclients.cjs');
const contractorRoutes = require('./routes/contractors.cjs');
const paymentCalendarRoutes = require('./routes/paymentCalendar.cjs');
const incomePlanRoutes = require('./routes/incomePlan.cjs');
const rulesRoutes = require('./routes/rules.cjs');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

initDB();

app.use('/api', authRoutes);
app.use('/api', transactionRoutes);
app.use('/api', dictionaryRoutes);
app.use('/api', initialDataRoutes);
app.use('/api', paymentRequestRoutes);
app.use('/api', masterIncomeRoutes);
app.use('/api', yclientsRoutes);
app.use('/api', contractorRoutes);
app.use('/api', paymentCalendarRoutes);
app.use('/api', incomePlanRoutes);
app.use('/api', rulesRoutes);

const fs = require('fs');
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: '30d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ViVi Finance Server running on http://0.0.0.0:${PORT}`);
});
