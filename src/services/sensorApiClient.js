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

const logIntegratorDebug = (...args) => {
  if (!config.debugIntegrator) return;
  console.log('[integrator]', ...args);
};

const redactPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = { ...payload };
  if ('password' in clone) clone.password = '***';
  return clone;
};

const parseJsonSafe = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

const fetchWithTimeout = async (url, timeoutMs, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { returnResponseMeta, ...fetchOptions } = options;

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    const data = await parseJsonSafe(response);
    if (!response.ok) {
      const error = new Error(
        `Sensor API error: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return returnResponseMeta
      ? { data, status: response.status }
      : data;
  } finally {
    clearTimeout(timer);
  }
};

const formatDateLocal = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

const formatDateTimeLocal = (date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);

const buildIntegratorPayload = () => {
  const today = formatDateLocal(new Date());
  const rangeStart = `${today} 00:00:00`;
  const rangeEnd = formatDateTimeLocal(new Date());

  const payload = {
    range_date_start: rangeStart,
    range_date_end: rangeEnd,
    range_date_columns: config.integrator.rangeDateColumn,
    page: 1,
    page_size: config.integrator.pageSize
  };

  if (config.integrator.filterColumns && config.integrator.filterValue !== '') {
    payload.filter_columns = config.integrator.filterColumns;
    payload.filter_value = config.integrator.filterValue;
  }

  return payload;
};

const buildBasicAuthHeader = () => {
  if (!config.integrator.username) return null;
  const token = Buffer.from(
    `${config.integrator.username}:${config.integrator.password || ''}`
  ).toString('base64');
  return `Basic ${token}`;
};

const mapIntegratorEventToReading = (event) => {
  const device = event.device || {};
  const sensorId = device.imei || device.name || event.device_id || event.id;
  const status = event.is_followed_up ? 'Followed Up' : 'Open';
  const speed = Number.isFinite(Number(event.speed)) ? Number(event.speed) : null;
  const timestamp = event.server_time || event.upload_at || event.time;

  const location = event.geofence?.name
    ? event.geofence.name
    : Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))
      ? `Lat ${Number(event.latitude).toFixed(6)}, Long ${Number(event.longitude).toFixed(6)}`
      : 'Unknown';

  return normalizeReading(sensorId, {
    status,
    value: speed,
    timestamp,
    receivedAt: event.updated_at || event.upload_at || new Date().toISOString(),
    source: 'integrator',
    meta: {
      id: event.id,
      identity: event.identity,
      unit: device.name || device.imei || sensorId,
      operator: event.driver?.name || event.manual_verification_by || 'Unknown Operator',
      type: event.name || 'Fatigue',
      area: config.defaultArea,
      location,
      speed: speed !== null ? `${speed} km/h` : undefined,
      count: 1,
      status,
      alarmType: event.alarm_type,
      alarmLevel: event.level,
      groupName: device.group_name,
      imei: device.imei,
      deviceId: event.device_id,
      latitude: event.latitude,
      longitude: event.longitude
    }
  });
};

const fetchIntegratorEvents = async () => {
  if (!config.integrator.baseUrl) {
    throw new Error('INTEGRATOR_BASE_URL is not set');
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (config.integrator.authMode === 'basic') {
    const authHeader = buildBasicAuthHeader();
    if (authHeader) {
      headers.Authorization = authHeader;
    }
  }

  const payload = buildIntegratorPayload();
  if (config.integrator.authMode === 'body') {
    payload.username = config.integrator.username;
    payload.password = config.integrator.password;
  }

  logIntegratorDebug('Request', {
    url: config.integrator.baseUrl,
    authMode: config.integrator.authMode,
    payload: redactPayload(payload)
  });

  let responseMeta;
  try {
    responseMeta = await fetchWithTimeout(
      config.integrator.baseUrl,
      config.sensorApiTimeoutMs,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        returnResponseMeta: true
      }
    );
  } catch (error) {
    logIntegratorDebug('Error', {
      status: error.status,
      message: error.message,
      response: error.data && typeof error.data === 'object'
        ? {
            code: error.data.code,
            success: error.data.success,
            message: error.data.message
          }
        : error.data
    });
    throw error;
  }

  const data = responseMeta?.data;

  logIntegratorDebug('Response', {
    status: responseMeta?.status,
    success: data?.success,
    message: data?.message,
    count: data?.data?.list?.length || 0,
    pagination: data?.data?.pagination || null
  });

  if (!data || data.success === false) {
    throw new Error(data?.message || 'Integrator API request failed');
  }

  const list = data?.data?.list || [];
  return list.map(mapIntegratorEventToReading);
};

const fetchSensor = async (sensorId) => {
  if (config.sensorApiMode === 'mock') {
    return generateMockReading(sensorId);
  }

  if (config.sensorApiMode === 'integrator') {
    throw new Error('Integrator mode does not support per-sensor fetch');
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
  if (config.sensorApiMode === 'integrator') {
    return fetchIntegratorEvents();
  }

  const tasks = (sensorIds || []).map((sensorId) => fetchSensor(sensorId));
  const results = await Promise.allSettled(tasks);

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
};

module.exports = { fetchSensor, fetchAllSensors };
