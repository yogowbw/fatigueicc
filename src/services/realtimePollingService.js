const { config } = require('../config/env');
const { fetchAllSensors } = require('./sensorApiClient');

const pollingState = {
  isRunning: false,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastDurationMs: null
};

const pollOnce = async (cache) => {
  const start = Date.now();
  try {
    const readings = await fetchAllSensors(config.sensorIds);
    const receivedAt = new Date().toISOString();
    readings.forEach((reading) =>
      cache.upsert({ ...reading, receivedAt, source: 'realtime' })
    );

    pollingState.lastSuccessAt = receivedAt;
    pollingState.lastErrorAt = null;
    pollingState.lastErrorMessage = null;
    pollingState.lastDurationMs = Date.now() - start;
  } catch (error) {
    pollingState.lastErrorAt = new Date().toISOString();
    pollingState.lastErrorMessage = error.message || 'Unknown error';
  }
};

const startRealtimePolling = (cache) => {
  if (pollingState.isRunning) return null;

  pollingState.isRunning = true;
  pollOnce(cache);

  const timer = setInterval(() => {
    pollOnce(cache);
  }, config.sensorPollIntervalMs);

  return () => {
    clearInterval(timer);
    pollingState.isRunning = false;
  };
};

const getPollingStatus = () => ({ ...pollingState });

module.exports = { startRealtimePolling, getPollingStatus };
