const { config } = require('../config/env');

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const mockOperators = ['Budi S.', 'Dedi S.', 'Rian J.', 'Doni K.', 'Yanto', 'Agus R.'];
const mockLocationsMining = ['Manado - Front A', 'Manado - Front B', 'Pit Utara'];
const mockLocationsHauling = ['KM 10', 'KM 22', 'KM 45', 'KM 55'];

const normalizeReading = (sensorId, data) => {
  const timestamp = data.timestamp || new Date().toISOString();
  const status = data.status || data.state || 'online';

  return {
    sensorId,
    status,
    value: typeof data.value === 'number' ? data.value : Number(data.value),
    timestamp,
    receivedAt: data.receivedAt || new Date().toISOString(),
    source: data.source || 'realtime',
    meta: data.meta || {
      unit: data.unit || sensorId,
      operator: data.operator,
      type: data.type,
      area: data.area,
      location: data.location,
      speed: data.speed,
      count: data.count
    }
  };
};

const generateMockReading = (sensorId) => {
  const area = sensorId.startsWith('HD') || sensorId.startsWith('WT')
    ? 'Hauling'
    : 'Mining';
  const location =
    area === 'Mining'
      ? randomFrom(mockLocationsMining)
      : randomFrom(mockLocationsHauling);
  const value = Number((Math.random() * 100).toFixed(2));
  const status = Math.random() < 0.05 ? 'offline' : 'online';
  const timestamp = new Date().toISOString();

  return normalizeReading(sensorId, {
    status,
    value,
    timestamp,
    source: 'mock',
    meta: {
      unit: sensorId,
      operator: randomFrom(mockOperators),
      type: 'Fatigue',
      area,
      location,
      speed: `${Math.floor(Math.random() * 40) + 10} km/h`,
      count: Math.max(1, Math.floor(Math.random() * 4))
    }
  });
};

const fetchWithTimeout = async (url, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Sensor API error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const fetchSensor = async (sensorId) => {
  if (config.sensorApiMode === 'mock') {
    return generateMockReading(sensorId);
  }

  if (!config.sensorApiBaseUrl) {
    throw new Error('SENSOR_API_BASE_URL is not set');
  }

  const url = `${config.sensorApiBaseUrl.replace(/\/$/, '')}/sensors/${encodeURIComponent(
    sensorId
  )}`;
  const data = await fetchWithTimeout(url, config.sensorApiTimeoutMs);
  return normalizeReading(sensorId, data);
};

const fetchAllSensors = async (sensorIds) => {
  const tasks = sensorIds.map((sensorId) => fetchSensor(sensorId));
  const results = await Promise.allSettled(tasks);

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
};

module.exports = { fetchSensor, fetchAllSensors };
