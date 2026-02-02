const { config } = require('../config/env');
const { fetchAllSensors, fetchDevicesAll } = require('./sensorApiClient');
const { deviceHealthCache } = require('../cache/deviceHealthCache');

const pollingState = {
  isRunning: false,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastDurationMs: null
};

const devicePollingState = {
  isRunning: false,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastDurationMs: null
};

const pollOnce = async (cache, eventsCache) => {
  const start = Date.now();
  try {
    const readings = await fetchAllSensors(config.sensorIds);
    const receivedAt = new Date().toISOString();
    const normalized = readings.map((reading) => ({
      ...reading,
      receivedAt,
      source: reading.source || 'realtime'
    }));

    normalized.forEach((reading) => cache.upsert(reading));

    if (eventsCache && config.sensorApiMode === 'integrator') {
      eventsCache.replace(normalized);
    }

    pollingState.lastSuccessAt = receivedAt;
    pollingState.lastErrorAt = null;
    pollingState.lastErrorMessage = null;
    pollingState.lastDurationMs = Date.now() - start;
  } catch (error) {
    pollingState.lastErrorAt = new Date().toISOString();
    pollingState.lastErrorMessage = error.message || 'Unknown error';
  }
};

const pollDevicesOnce = async () => {
  const start = Date.now();
  try {
    const devices = await fetchDevicesAll();
    const total = devices.length;
    const online = devices.filter((device) => device.acc === true).length;
    const offline = Math.max(0, total - online);
    const coverage = total > 0 ? Math.round((online / total) * 100) : 0;

    deviceHealthCache.set({
      total,
      online,
      offline,
      coverage,
      source: 'integrator',
      updatedAt: new Date().toISOString()
    });

    devicePollingState.lastSuccessAt = new Date().toISOString();
    devicePollingState.lastErrorAt = null;
    devicePollingState.lastErrorMessage = null;
    devicePollingState.lastDurationMs = Date.now() - start;
  } catch (error) {
    devicePollingState.lastErrorAt = new Date().toISOString();
    devicePollingState.lastErrorMessage = error.message || 'Unknown error';
  }
};

const startRealtimePolling = (cache, eventsCache) => {
  if (pollingState.isRunning) return null;

  pollingState.isRunning = true;
  pollOnce(cache, eventsCache);

  const timer = setInterval(() => {
    pollOnce(cache, eventsCache);
  }, config.sensorPollIntervalMs);

  return () => {
    clearInterval(timer);
    pollingState.isRunning = false;
  };
};

const startDevicePolling = () => {
  if (devicePollingState.isRunning) return null;
  if (config.deviceHealthMode !== 'integrator') return null;

  devicePollingState.isRunning = true;
  pollDevicesOnce();

  const timer = setInterval(() => {
    pollDevicesOnce();
  }, config.devicePollIntervalMs || 10000);

  return () => {
    clearInterval(timer);
    devicePollingState.isRunning = false;
  };
};

const getPollingStatus = () => ({ ...pollingState });
const getDevicePollingStatus = () => ({ ...devicePollingState });

module.exports = {
  startRealtimePolling,
  startDevicePolling,
  getPollingStatus,
  getDevicePollingStatus
};
