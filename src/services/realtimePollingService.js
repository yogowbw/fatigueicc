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
    // Per user request: acc -1 and 0 are offline, everything else is online.
    const offline = devices.filter(
      (device) => device.acc === -1 || device.acc === 0
    ).length;
    const online = total - offline;
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

  let timerId = null;
  pollingState.isRunning = true;

  const pollLoop = async () => {
    await pollOnce(cache, eventsCache);
    if (pollingState.isRunning) {
      timerId = setTimeout(pollLoop, config.sensorPollIntervalMs);
    }
  };

  pollLoop();

  return () => {
    if (timerId) clearTimeout(timerId);
    pollingState.isRunning = false;
  };
};

const startDevicePolling = () => {
  if (devicePollingState.isRunning) return null;
  if (config.deviceHealthMode !== 'integrator') return null;

  let timerId = null;
  devicePollingState.isRunning = true;

  const pollLoop = async () => {
    await pollDevicesOnce();
    if (devicePollingState.isRunning) {
      timerId = setTimeout(pollLoop, config.devicePollIntervalMs || 10000);
    }
  };

  pollLoop();

  return () => {
    if (timerId) clearTimeout(timerId);
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
