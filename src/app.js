const express = require('express');
const { dashboardRouter } = require('./routes/dashboardRoutes');

const createApp = () => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/dashboard', dashboardRouter);

  return app;
};

module.exports = { createApp };
