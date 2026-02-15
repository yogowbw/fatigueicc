const express = require('express');
const { dashboardRouter } = require('./routes/dashboardRoutes');
const { configRouter } = require('./routes/configRoutes');

const createApp = () => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/config', configRouter);

  return app;
};

module.exports = { createApp };
