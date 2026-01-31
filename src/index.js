const { config } = require('./config/env');
const { createApp } = require('./app');
const { sensorCache } = require('./cache/sensorCache');
const { startRealtimePolling } = require('./services/realtimePollingService');
const { startPersistenceJob } = require('./services/persistenceService');
const { getPool } = require('./db/sqlServer');

const app = createApp();

const start = async () => {
  try {
    await getPool();
    console.log('Connected to SQL Server');
  } catch (error) {
    console.warn('SQL Server connection failed. API will still run:', error.message || error);
  }

  startRealtimePolling(sensorCache);
  startPersistenceJob(sensorCache);

  app.listen(config.port, () => {
    console.log(`Dashboard API running on http://localhost:${config.port}`);
  });
};

start();
