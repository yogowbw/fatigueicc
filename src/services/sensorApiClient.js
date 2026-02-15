const { config } = require('../config/env');
const { getSensorApiMode } = require('../config/runtimeState');

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const mockOperators = ['Budi S.', 'Dedi S.', 'Rian J.', 'Doni K.', 'Yanto', 'Agus R.'];
const mockLocationsMining = ['Manado - Front A', 'Manado - Front B', 'Pit Utara'];
const mockLocationsHauling = ['KM 10', 'KM 22', 'KM 45', 'KM 55'];
const MAX_FILTER_DEBUG_ENTRIES = 200;

const areaFilterDebugState = {
  updatedAt: null,
  total: 0,
  kept: 0,
  dropped: 0,
  entries: []
};

const setAreaFilterDebugState = (entries, total, kept) => {
  areaFilterDebugState.updatedAt = new Date().toISOString();
  areaFilterDebugState.total = total;
  areaFilterDebugState.kept = kept;
  areaFilterDebugState.dropped = Math.max(0, total - kept);
  areaFilterDebugState.entries = Array.isArray(entries)
    ? entries.slice(-MAX_FILTER_DEBUG_ENTRIES)
    : [];
};

const getAreaFilterDebugState = () => ({
  ...areaFilterDebugState,
  entries: [...areaFilterDebugState.entries]
});

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

const authState = {
  accessToken: null,
  token: null,
  obtainedAt: null
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

const formatDateTimeFixed = (date, timeValue) => {
  const time = String(timeValue || '').trim();
  if (!time) return formatDateTimeLocal(date);
  return `${formatDateLocal(date)} ${time}`;
};

const timeToMinutes = (value) => {
  if (!value) return null;
  const [hours, minutes, seconds] = String(value)
    .trim()
    .split(':')
    .map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  return hours * 60 + minutes + safeSeconds / 60;
};

const minutesToClock = (value) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return '00:00:00';
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
};

const getLocalClockMinutes = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);
  const hours = Number(parts.find((item) => item.type === 'hour')?.value);
  const minutes = Number(parts.find((item) => item.type === 'minute')?.value);
  const seconds = Number(parts.find((item) => item.type === 'second')?.value);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes + (Number.isFinite(seconds) ? seconds : 0) / 60;
};

const isWithinWindow = (minutes, window) => {
  if (minutes === null || !window?.start || !window?.end) return true;
  const start = timeToMinutes(window.start);
  const end = timeToMinutes(window.end);
  if (start === null || end === null) return true;
  if (start <= end) {
    return minutes >= start && minutes <= end;
  }
  return minutes >= start || minutes <= end;
};

const getAreaWindowEnvelope = () => {
  const windows = Object.values(config.areaWindows || {});
  const starts = [];
  const ends = [];

  windows.forEach((window) => {
    const start = timeToMinutes(window?.start);
    const end = timeToMinutes(window?.end);
    if (start === null || end === null) return;
    starts.push(start);
    ends.push(end);
  });

  if (starts.length === 0 || ends.length === 0) {
    return null;
  }

  return {
    start: Math.min(...starts),
    end: Math.max(...ends)
  };
};

const getEventLocalMinutes = (event) => {
  // Prioritize `time` or `device_time` as they seem to represent the local event time,
  // which is what the area window filter expects. `server_time` is often in UTC and
  // should be used as a fallback.
  const timestamp =
    event?.time ||
    event?.device_time ||
    event?.server_time ||
    event?.upload_at ||
    event?.created_at;
  if (!timestamp) return null;

  const fromText = String(timestamp).match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (fromText) {
    const hours = Number(fromText[1]);
    const minutes = Number(fromText[2]);
    const seconds = Number(fromText[3] || 0);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes + (Number.isFinite(seconds) ? seconds : 0) / 60;
    }
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalClockMinutes(parsed);
};

const resolveRangeEnd = (date) => {
  if (config.integrator.rangeEndMode === 'end_of_day') {
    return formatDateTimeFixed(date, '23:59:59');
  }
  if (config.integrator.rangeEndMode === 'fixed') {
    return formatDateTimeFixed(date, config.integrator.rangeEndTime || '23:59:59');
  }
  return formatDateTimeLocal(date);
};

const buildIntegratorPayload = (page = 1) => {
  const now = new Date();
  const today = formatDateLocal(now);
  const envelope = getAreaWindowEnvelope();
  const rangeStartTime = envelope
    ? minutesToClock(envelope.start)
    : config.integrator.rangeStartTime || '00:00:00';
  const rangeStart = `${today} ${rangeStartTime}`;

  let rangeEnd = resolveRangeEnd(now);
  if (envelope) {
    const localNowMinutes = getLocalClockMinutes(now);
    const cappedEnd = Number.isFinite(localNowMinutes)
      ? Math.min(localNowMinutes, envelope.end)
      : envelope.end;
    const safeEnd = Math.max(envelope.start, cappedEnd);
    rangeEnd = `${today} ${minutesToClock(safeEnd)}`;
  }

  const payload = {
    range_date_start: rangeStart,
    range_date_end: rangeEnd,
    range_date_columns: 'device_time',
    page,
    page_size: config.integrator.pageSize
  };

  const filterColumns =
    typeof config.integrator.filterColumns === 'string'
      ? config.integrator.filterColumns.trim()
      : config.integrator.filterColumns;
  const filterValue =
    typeof config.integrator.filterValue === 'string'
      ? config.integrator.filterValue.trim()
      : config.integrator.filterValue;

  if (filterColumns && filterValue !== '') {
    payload.filter_columns = filterColumns;
    payload.filter_value = filterValue;
  }

  return payload;
};
const normalizeText = (value) => String(value || '').toLowerCase();

const matchesAnyKeyword = (value, keywords) => {
  if (!value || !keywords || keywords.length === 0) return false;
  const normalized = normalizeText(value);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
};

const startsWithAny = (value, prefixes) => {
  if (!value || !prefixes || prefixes.length === 0) return false;
  const normalized = normalizeText(value);
  return prefixes.some((prefix) => normalized.startsWith(normalizeText(prefix)));
};

const normalizeArea = (area) => {
  const normalized = normalizeText(area).trim();
  if (normalized === 'hauling') return 'Hauling';
  if (normalized === 'mining') return 'Mining';
  return area || config.defaultArea;
};

const inferAreaFromEvent = (event, device) => {
  if (event?.area) return normalizeArea(event.area);

  const groupName = device?.group_name || '';
  if (matchesAnyKeyword(groupName, config.areaMapping.haulingGroupKeywords)) {
    return 'Hauling';
  }
  if (matchesAnyKeyword(groupName, config.areaMapping.miningGroupKeywords)) {
    return 'Mining';
  }

  // Priority 3: Check for location/geofence name prefixes
  const locationName = event?.geofence?.name || '';
  if (startsWithAny(locationName, config.areaMapping.haulingLocationPrefixes)) {
    return 'Hauling';
  }
  if (startsWithAny(locationName, config.areaMapping.miningLocationPrefixes)) {
    return 'Mining';
  }

  // Priority 4: Check for unit name prefixes
  const unit = device?.name || event?.device_id || '';
  if (startsWithAny(unit, config.areaMapping.haulingUnitPrefixes)) {
    return 'Hauling';
  }
  if (startsWithAny(unit, config.areaMapping.miningUnitPrefixes)) {
    return 'Mining';
  }

  // Priority 5: Fallback to default
  return normalizeArea(config.defaultArea);
};

const isEventWithinAreaWindow = (event) => {
  const area = inferAreaFromEvent(event, event?.device || {});
  const window = config.areaWindows?.[area];
  const minutes = getEventLocalMinutes(event);
  const result = isWithinWindow(minutes, window);

  if (config.debugIntegrator) {
    const timeStr = event?.time || event?.device_time || event?.server_time || 'N/A';
    const unitId = event?.device?.name || event?.device_id || 'Unknown';
    const decision = result ? 'KEPT' : 'DROPPED';
    const reason = result
      ? 'within shift'
      : `outside ${area} shift (${window?.start}-${window?.end})`;

    console.log(
      `[filter-check] ${decision} | Unit: ${unitId}, Time: ${timeStr}, Reason: ${reason}`
    );
  }

  return result;
};

const buildFilterDebugEntry = (event) => {
  const area = inferAreaFromEvent(event, event?.device || {});
  const window = config.areaWindows?.[area];
  const minutes = getEventLocalMinutes(event);
  const kept = isWithinWindow(minutes, window);
  const timeStr = event?.time || event?.device_time || event?.server_time || 'N/A';
  const unitId = event?.device?.name || event?.device_id || 'Unknown';

  return {
    decision: kept ? 'KEPT' : 'DROPPED',
    unit: unitId,
    time: timeStr,
    area,
    window: window ? `${window.start}-${window.end}` : null,
    reason: kept
      ? 'within shift'
      : `outside ${area} shift (${window?.start}-${window?.end})`
  };
};

const resolveLoginUrl = () => {
  if (config.integrator.loginUrl) return config.integrator.loginUrl;
  if (!config.integrator.baseUrl) return '';
  try {
    const base = new URL(config.integrator.baseUrl);
    return new URL('/api/v1/vss/auth', base).toString();
  } catch (error) {
    return '';
  }
};

const loginIntegrator = async () => {
  const loginUrl = resolveLoginUrl();
  if (!loginUrl) {
    throw new Error('INTEGRATOR_LOGIN_URL is not set');
  }
  if (!config.integrator.username || !config.integrator.password) {
    throw new Error('INTEGRATOR_USERNAME or INTEGRATOR_PASSWORD is missing');
  }

  logIntegratorDebug('Login', { url: loginUrl, username: config.integrator.username });

  const responseMeta = await fetchWithTimeout(loginUrl, config.sensorApiTimeoutMs, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      username: config.integrator.username,
      password: config.integrator.password
    }),
    returnResponseMeta: true
  });

  const data = responseMeta?.data;
  if (!data || data.success === false) {
    throw new Error(data?.message || 'Integrator login failed');
  }

  const accessToken = data?.data?.access_token || null;
  const token = data?.data?.token || null;

  if (!accessToken) {
    throw new Error('Integrator login did not return access_token');
  }

  authState.accessToken = accessToken;
  authState.token = token;
  authState.obtainedAt = new Date().toISOString();

  logIntegratorDebug('Login success', {
    hasAccessToken: Boolean(accessToken),
    hasToken: Boolean(token)
  });

  return { accessToken, token };
};

const applyAuthHeaders = async (headers) => {
  if (
    config.integrator.authMode === 'login' ||
    config.integrator.authMode === 'auto'
  ) {
    if (!authState.accessToken) {
      await loginIntegrator();
    }
    if (authState.accessToken) {
      headers.Authorization = `Bearer ${authState.accessToken}`;
    }
    if (authState.token && !headers['x-token']) {
      headers['x-token'] = authState.token;
    }
  }
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
  const area = inferAreaFromEvent(event, device);
  const isWithinShift =
    typeof event?._isWithinShift === 'boolean'
      ? event._isWithinShift
      : isEventWithinAreaWindow(event);
  const driverName =
    event.driver?.name || event.driver_name || event.driverName || null;

  const location = event.geofence?.name
    ? event.geofence.name
    : Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))
      ? `Lat ${Number(event.latitude).toFixed(6)}, Long ${Number(event.longitude).toFixed(6)}`
      : 'Unknown';

  const alarmFiles = Array.isArray(event.alarm_file) ? event.alarm_file : [];
  const photoFile =
    alarmFiles.find(
      (file) =>
        typeof file?.downUrl === 'string' &&
        file.downUrl.toLowerCase().includes('.jpg')
    ) || alarmFiles.find((file) => typeof file?.downUrl === 'string');

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
      driver: driverName,
      operator: event.manual_verification_by || 'Unknown Verifier',
      type: 'Fatigue',
      fatigue: event.name || 'Fatigue',
      area,
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
      longitude: event.longitude,
      photoUrl: photoFile?.downUrl,
      isWithinShift
    }
  });
};

const resolveDevicesUrl = () => {
  if (config.integrator.devicesUrl) return config.integrator.devicesUrl;
  if (!config.integrator.baseUrl) return '';
  try {
    const base = new URL(config.integrator.baseUrl);
    return new URL('/api/v1/devices-all', base).toString();
  } catch (error) {
    return '';
  }
};

const buildIntegratorHeaders = async () => {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (config.integrator.xToken) {
    headers['x-token'] = config.integrator.xToken;
  }

  if (config.integrator.accessToken) {
    headers.access_token = config.integrator.accessToken;
  }

  if (
    config.integrator.authMode === 'basic' ||
    config.integrator.authMode === 'both'
  ) {
    const authHeader = buildBasicAuthHeader();
    if (authHeader) {
      headers.Authorization = authHeader;
    }
  }

  if (config.integrator.authMode === 'header' && config.integrator.authHeader) {
    headers.Authorization = config.integrator.authHeader;
  }

  await applyAuthHeaders(headers);

  return headers;
};

const fetchIntegratorEvents = async () => {
  if (!config.integrator.baseUrl) {
    throw new Error('INTEGRATOR_BASE_URL is not set');
  }

  const headers = await buildIntegratorHeaders();

  logIntegratorDebug('Headers', {
    hasAuthorization: Boolean(headers.Authorization),
    authPrefix: headers.Authorization
      ? String(headers.Authorization).split(' ')[0]
      : null,
    hasXToken: Boolean(headers['x-token']),
    hasAccessToken: Boolean(headers.access_token)
  });

  const payload = buildIntegratorPayload(1);
  if (
    config.integrator.authMode === 'body' ||
    config.integrator.authMode === 'both'
  ) {
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
    if (
      error.status === 401 &&
      (config.integrator.authMode === 'login' ||
        config.integrator.authMode === 'auto')
    ) {
      await loginIntegrator();
      await applyAuthHeaders(headers);
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
    } else {
      logIntegratorDebug('Error', {
        status: error.status,
        message: error.message,
        response:
          error.data && typeof error.data === 'object'
            ? {
                code: error.data.code,
                success: error.data.success,
                message: error.data.message
              }
            : error.data
      });
      throw error;
    }
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

  let list = data?.data?.list || [];
  const pagination = data?.data?.pagination;

  if (
    config.integrator.fetchAllPages &&
    pagination?.total_pages &&
    pagination.total_pages > 1
  ) {
    const totalPages = Math.min(
      Number(pagination.total_pages),
      config.integrator.maxPages
    );

    for (let page = 2; page <= totalPages; page += 1) {
      const pagePayload = buildIntegratorPayload(page);
      logIntegratorDebug('Request', {
        url: config.integrator.baseUrl,
        authMode: config.integrator.authMode,
        payload: redactPayload(pagePayload)
      });

      const pageResponse = await fetchWithTimeout(
        config.integrator.baseUrl,
        config.sensorApiTimeoutMs,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(pagePayload),
          returnResponseMeta: true
        }
      );

      const pageData = pageResponse?.data;
      if (pageData?.success === false) break;

      const pageList = pageData?.data?.list || [];
      list = list.concat(pageList);
    }
  }

  const filterEntries = list.map(buildFilterDebugEntry);
  const filteredList = list.filter((event, index) => {
    const kept = filterEntries[index]?.decision === 'KEPT';
    if (kept) {
      event._isWithinShift = true;
    }
    return kept;
  });
  setAreaFilterDebugState(filterEntries, list.length, filteredList.length);
  logIntegratorDebug('Area window filter', {
    total: list.length,
    kept: filteredList.length
  });

  return filteredList.map(mapIntegratorEventToReading);
};

const fetchDevicesAll = async () => {
  const devicesUrl = resolveDevicesUrl();
  if (!devicesUrl) {
    throw new Error('INTEGRATOR_DEVICES_URL is not set');
  }

  const headers = await buildIntegratorHeaders();

  logIntegratorDebug('Devices Headers', {
    hasAuthorization: Boolean(headers.Authorization),
    authPrefix: headers.Authorization
      ? String(headers.Authorization).split(' ')[0]
      : null,
    hasXToken: Boolean(headers['x-token']),
    hasAccessToken: Boolean(headers.access_token)
  });

  let responseMeta;
  try {
    responseMeta = await fetchWithTimeout(
      devicesUrl,
      config.sensorApiTimeoutMs,
      {
        method: 'GET',
        headers,
        returnResponseMeta: true
      }
    );
  } catch (error) {
    if (
      error.status === 401 &&
      (config.integrator.authMode === 'login' ||
        config.integrator.authMode === 'auto')
    ) {
      await loginIntegrator();
      const retryHeaders = await buildIntegratorHeaders();
      responseMeta = await fetchWithTimeout(
        devicesUrl,
        config.sensorApiTimeoutMs,
        {
          method: 'GET',
          headers: retryHeaders,
          returnResponseMeta: true
        }
      );
    } else {
      logIntegratorDebug('Devices Error', {
        status: error.status,
        message: error.message,
        response:
          error.data && typeof error.data === 'object'
            ? {
                code: error.data.code,
                success: error.data.success,
                message: error.data.message
              }
            : error.data
      });
      throw error;
    }
  }

  const data = responseMeta?.data;

  logIntegratorDebug('Devices Response', {
    status: responseMeta?.status,
    success: data?.success,
    message: data?.message,
    count: data?.data?.list?.length || data?.data?.length || 0
  });

  if (!data || data.success === false) {
    throw new Error(data?.message || 'Integrator devices request failed');
  }

  return data?.data?.list || data?.data || [];
};

const fetchSensor = async (sensorId) => {
  const currentMode = getSensorApiMode();
  if (!config.sensorApiBaseUrl) {
    if (currentMode === 'mock') {
      return generateMockReading(sensorId);
    }
    throw new Error('SENSOR_API_BASE_URL is not set');
  }

  const base = config.sensorApiBaseUrl.replace(/\/$/, '');
  const url = `${base}/sensors/${encodeURIComponent(sensorId)}`;
  const data = await fetchWithTimeout(url, config.sensorApiTimeoutMs);
  return normalizeReading(sensorId, {
    ...data,
    source: currentMode === 'mock' ? 'mock' : data?.source
  });
};

const fetchAllSensors = async (sensorIds) => {
  const currentMode = getSensorApiMode();
  if (currentMode === 'real' && config.integrator.baseUrl) {
    return fetchIntegratorEvents();
  }

  const tasks = (sensorIds || []).map((sensorId) => fetchSensor(sensorId));
  const results = await Promise.allSettled(tasks);

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
};

module.exports = {
  fetchSensor,
  fetchAllSensors,
  fetchDevicesAll,
  getAreaFilterDebugState
};
