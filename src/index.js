const { config } = require('./config/env');
const { createApp } = require('./app');
const { sensorCache } = require('./cache/sensorCache');
const { eventCache } = require('./cache/eventCache');
const { startRealtimePolling, startDevicePolling } = require('./services/realtimePollingService');
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

  startRealtimePolling(sensorCache, eventCache);
  startDevicePolling();
  startPersistenceJob(sensorCache, eventCache);

  app.listen(config.port, () => {
    console.log(`Dashboard API running on http://localhost:${config.port}`);
  });
};

start();
