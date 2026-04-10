require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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
const reconciliationRoutes = require('./routes/reconciliation.cjs');

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
app.use('/api', reconciliationRoutes);

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

  app.get(/.*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

function startAutoTransferScheduler() {
  const db = require('./db.cjs');
  const http = require('http');

  setInterval(async () => {
    try {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hh}:${mm}`;
      const today = now.toISOString().split('T')[0];

      const rules = await db.query(
        `SELECT id FROM auto_transfer_rules WHERE enabled = true AND execute_time = $1 AND (last_run_date IS NULL OR last_run_date < $2::date)`,
        [currentTime, today]
      );

      if (rules.rows.length > 0) {
        const ruleIds = rules.rows.map(r => r.id);
        const body = JSON.stringify({ ruleIds });
        const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/api/auto-transfer-rules/execute', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
        req.on('error', (e) => console.error('Auto-transfer scheduler request error:', e.message));
        req.write(body);
        req.end();
      }
    } catch (err) {
      console.error('Auto-transfer scheduler error:', err.message);
    }
  }, 60 * 1000);
}

async function startServer() {
  try {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`ViVi Finance Server running on http://0.0.0.0:${PORT}`);
      startAutoTransferScheduler();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();