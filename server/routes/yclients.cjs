const express = require('express');
const router = express.Router();
const { verifyTransaction, verifyBatch } = require('../services/yclients.cjs');

router.post('/yclients/verify/:id', async (req, res) => {
  try {
    const result = await verifyTransaction(parseInt(req.params.id));
    res.json(result);
  } catch (err) {
    console.error('YClients verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/yclients/verify-batch', async (req, res) => {
  const { studioId, dateFrom, dateTo } = req.body;
  if (!studioId || !dateFrom || !dateTo) {
    return res.status(400).json({ error: 'studioId, dateFrom, dateTo required' });
  }
  try {
    const result = await verifyBatch(studioId, dateFrom, dateTo);
    res.json(result);
  } catch (err) {
    console.error('YClients batch verify error:', err);
    res.status(500).json({ error: 'Batch verification failed' });
  }
});

module.exports = router;
