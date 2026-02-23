const { config } = require('../config/env');
const { getSensorApiMode } = require('../config/runtimeState');

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const mockOperators = ['Budi S.', 'Dedi S.', 'Rian J.', 'Doni K.', 'Yanto', 'Agus R.'];
const mockLocationsMining = ['Manado - Front A', 'Manado - Front B', 'Pit Utara'];
const mockLocationsHauling = ['KM 10', 'KM 22', 'KM 45', 'KM 55'];
const DATE_TIME_TEXT_REGEX =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;

const areaFilterDebugState = {
  updatedAt: null,
  total: 0,
  kept: 0,
  dropped: 0,
  entries: []
};

const setAreaFilterDebugState = (entries, total, kept) => {
  const maxEntries = Math.max(
    1,
    Number(config.integrator?.maxFilterDebugEntries) || 200
  );
  areaFilterDebugState.updatedAt = new Date().toISOString();
  areaFilterDebugState.total = total;
  areaFilterDebugState.kept = kept;
  areaFilterDebugState.dropped = Math.max(0, total - kept);
  areaFilterDebugState.entries = Array.isArray(entries)
    ? entries.slice(-maxEntries)
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
  obtainedAt: null,
  loginPromise: null
};

const integratorIncrementalState = {
  localDate: null,
  lastRangeEnd: null,
  lastFullSyncAt: null,
  eventsByKey: new Map(),
  filterDebugByKey: new Map()
};

const shiftCutoffState = {
  currentKey: null,
  lastResetAt: null
};

const pendingRawEventsState = {
  byKey: new Map(),
  order: []
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isAbortError = (error) =>
  error?.name === 'AbortError' ||
  String(error?.message || '').toLowerCase().includes('aborted');

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
  } catch (error) {
    if (isAbortError(error)) {
      const timeoutError = new Error(`Sensor API timeout after ${timeoutMs} ms`);
      timeoutError.code = 'ETIMEDOUT';
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const fetchWithRetry = async (url, timeoutMs, options = {}) => {
  const retries = config.integrator.requestRetries || 0;
  const retryDelayMs = config.integrator.retryDelayMs || 0;
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await fetchWithTimeout(url, timeoutMs, options);
    } catch (error) {
      lastError = error;
      const canRetry = error?.isTimeout === true || isAbortError(error);
      if (!canRetry || attempt >= retries) break;
      attempt += 1;
      logIntegratorDebug('Retry after timeout', {
        attempt,
        retries,
        delayMs: retryDelayMs
      });
      if (retryDelayMs > 0) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError;
};

const formatDateLocal = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);

const getTodayLocal = () => formatDateLocal(new Date());

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

const parseDateTimeText = (value) => {
  const match = String(value || '').match(DATE_TIME_TEXT_REGEX);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0)
  };
};

const dateTimeTextToMs = (value) => {
  const parsed = parseDateTimeText(value);
  if (!parsed) return null;
  return Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
    0
  );
};

const msToDateTimeText = (value) => {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const shiftDateTimeText = (value, deltaMs) => {
  const sourceMs = dateTimeTextToMs(value);
  if (!Number.isFinite(sourceMs)) return value;
  return msToDateTimeText(sourceMs + deltaMs) || value;
};

const laterDateTimeText = (a, b) => (String(a) > String(b) ? a : b);
const earlierDateTimeText = (a, b) => (String(a) < String(b) ? a : b);

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

const getAreaShiftDefinitions = (area) => {
  const shifts = config.areaShifts?.[area];
  if (Array.isArray(shifts) && shifts.length > 0) return shifts;
  const fallbackWindow = config.areaWindows?.[area];
  if (fallbackWindow?.start && fallbackWindow?.end) {
    return [
      {
        name: 'Shift',
        start: fallbackWindow.start,
        end: fallbackWindow.end
      }
    ];
  }
  return [];
};

const getEventShiftInfo = (area, minutes) => {
  const shifts = getAreaShiftDefinitions(area);
  if (!Number.isFinite(minutes) || shifts.length === 0) {
    return { isWithinShift: true, shiftLabel: null, windowLabel: null };
  }

  const matched = shifts.find((shift) => isWithinWindow(minutes, shift));
  if (matched) {
    return {
      isWithinShift: true,
      shiftLabel: matched.name || null,
      windowLabel:
        matched.start && matched.end ? `${matched.start}-${matched.end}` : null
    };
  }

  return { isWithinShift: false, shiftLabel: null, windowLabel: null };
};

const getActiveShiftInfo = (area, now = new Date()) => {
  const shifts = getAreaShiftDefinitions(area);
  const currentMinutes = getLocalClockMinutes(now);
  if (!Number.isFinite(currentMinutes) || shifts.length === 0) {
    return { shiftLabel: null, windowLabel: null, start: null, end: null };
  }

  const active = shifts.find((shift) => isWithinWindow(currentMinutes, shift));
  if (!active) {
    return { shiftLabel: null, windowLabel: null, start: null, end: null };
  }

  return {
    shiftLabel: active.name || null,
    windowLabel: active.start && active.end ? `${active.start}-${active.end}` : null,
    start: active.start || null,
    end: active.end || null
  };
};

const shouldKeepEventForActiveShift = (area, shiftInfo, activeShiftInfo) => {
  const hasShiftConfig = getAreaShiftDefinitions(area).length > 0;
  if (!hasShiftConfig) return shiftInfo.isWithinShift;
  if (!shiftInfo.isWithinShift) return false;
  if (!shiftInfo.shiftLabel || !activeShiftInfo.shiftLabel) return true;
  return shiftInfo.shiftLabel === activeShiftInfo.shiftLabel;
};

const getCurrentShiftCutoffKey = (now = new Date()) => {
  const miningShift = getActiveShiftInfo('Mining', now).shiftLabel || 'Unknown';
  const haulingShift = getActiveShiftInfo('Hauling', now).shiftLabel || 'Unknown';
  return `M:${miningShift}|H:${haulingShift}`;
};

const resetAreaFilterDebugState = () => {
  integratorIncrementalState.filterDebugByKey.clear();
  setAreaFilterDebugState([], 0, 0);
};

const resetRawEventQueue = () => {
  pendingRawEventsState.byKey.clear();
  pendingRawEventsState.order = [];
};

const enforceShiftCutoff = (now = new Date()) => {
  const nextKey = getCurrentShiftCutoffKey(now);
  if (!shiftCutoffState.currentKey) {
    shiftCutoffState.currentKey = nextKey;
    return { changed: false, currentKey: nextKey, previousKey: null, resetAt: null };
  }

  if (shiftCutoffState.currentKey === nextKey) {
    return {
      changed: false,
      currentKey: nextKey,
      previousKey: shiftCutoffState.currentKey,
      resetAt: shiftCutoffState.lastResetAt
    };
  }

  const previousKey = shiftCutoffState.currentKey;
  shiftCutoffState.currentKey = nextKey;
  shiftCutoffState.lastResetAt = new Date().toISOString();
  resetIncrementalState();
  resetAreaFilterDebugState();
  resetRawEventQueue();

  logIntegratorDebug('Shift cutoff reset', {
    previousShiftKey: previousKey,
    currentShiftKey: nextKey,
    resetAt: shiftCutoffState.lastResetAt
  });

  return {
    changed: true,
    currentKey: nextKey,
    previousKey,
    resetAt: shiftCutoffState.lastResetAt
  };
};

const enqueueRawEvents = (events) => {
  (events || []).forEach((event) => {
    const key = getIntegratorEventKey(event);
    if (!key || pendingRawEventsState.byKey.has(key)) return;
    pendingRawEventsState.byKey.set(key, event);
    pendingRawEventsState.order.push(key);
  });

  const maxQueue = 10000;
  while (pendingRawEventsState.order.length > maxQueue) {
    const oldest = pendingRawEventsState.order.shift();
    pendingRawEventsState.byKey.delete(oldest);
  }
};

const drainPendingRawEvents = () => {
  const drained = pendingRawEventsState.order
    .map((key) => pendingRawEventsState.byKey.get(key))
    .filter(Boolean);
  resetRawEventQueue();
  return drained;
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

const getYesterdayLocal = (now = new Date()) => {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return formatDateLocal(yesterday);
};

const getActiveShiftRangeStartForArea = (area, now = new Date()) => {
  const active = getActiveShiftInfo(area, now);
  if (!active?.start) return null;

  const shiftStartMinutes = timeToMinutes(active.start);
  const shiftEndMinutes = timeToMinutes(active.end);
  const nowMinutes = getLocalClockMinutes(now);
  if (
    !Number.isFinite(shiftStartMinutes) ||
    !Number.isFinite(shiftEndMinutes) ||
    !Number.isFinite(nowMinutes)
  ) {
    return null;
  }

  const isCrossMidnight = shiftStartMinutes > shiftEndMinutes;
  const hasRolledFromYesterday = isCrossMidnight && nowMinutes <= shiftEndMinutes;
  const startDate = hasRolledFromYesterday ? getYesterdayLocal(now) : formatDateLocal(now);
  return `${startDate} ${minutesToClock(shiftStartMinutes)}`;
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

const buildIntegratorRange = (now = new Date()) => {
  const today = formatDateLocal(now);
  const shiftStartCandidates = ['Mining', 'Hauling']
    .map((area) => getActiveShiftRangeStartForArea(area, now))
    .filter(Boolean);

  let rangeStart = `${today} ${config.integrator.rangeStartTime || '00:00:00'}`;
  if (shiftStartCandidates.length > 0) {
    rangeStart = shiftStartCandidates.reduce((earliest, current) =>
      earlierDateTimeText(earliest, current)
    );
  }
  const rangeEnd = resolveRangeEnd(now);

  return {
    today,
    rangeStart,
    rangeEnd
  };
};

const buildIntegratorPayload = (page = 1, range = {}) => {
  const payload = {
    range_date_start: range.rangeStart,
    range_date_end: range.rangeEnd,
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

const resetIncrementalState = () => {
  integratorIncrementalState.localDate = null;
  integratorIncrementalState.lastRangeEnd = null;
  integratorIncrementalState.lastFullSyncAt = null;
  integratorIncrementalState.eventsByKey.clear();
  integratorIncrementalState.filterDebugByKey.clear();
};

const shouldRunFullSync = () => {
  if (!config.integrator.incrementalEnabled) return true;
  if (!integratorIncrementalState.lastRangeEnd) return true;

  const intervalMs = (config.integrator.fullResyncMinutes || 30) * 60 * 1000;
  if (!integratorIncrementalState.lastFullSyncAt) return true;

  const lastFull = new Date(integratorIncrementalState.lastFullSyncAt).getTime();
  if (!Number.isFinite(lastFull)) return true;
  return Date.now() - lastFull >= intervalMs;
};

const resolveIncrementalRange = () => {
  const baseRange = buildIntegratorRange(new Date());
  const today = baseRange.today;

  if (integratorIncrementalState.localDate && integratorIncrementalState.localDate !== today) {
    resetIncrementalState();
  }

  if (!config.integrator.incrementalEnabled || shouldRunFullSync()) {
    return {
      ...baseRange,
      isFullSync: true,
      reason: 'full-sync'
    };
  }

  const overlapMs = (config.integrator.incrementalOverlapSeconds || 90) * 1000;
  const candidateStart = shiftDateTimeText(
    integratorIncrementalState.lastRangeEnd,
    -overlapMs
  );
  const incrementalStart = laterDateTimeText(candidateStart, baseRange.rangeStart);
  const safeStart = earlierDateTimeText(incrementalStart, baseRange.rangeEnd);

  return {
    ...baseRange,
    rangeStart: safeStart,
    isFullSync: false,
    reason: 'incremental'
  };
};

const normalizeKeyPart = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const getIntegratorEventKey = (event) => {
  const id = normalizeKeyPart(event?.id);
  if (id) return `id:${id}`;

  const identity = normalizeKeyPart(event?.identity);
  if (identity) return `identity:${identity}`;

  const device = normalizeKeyPart(
    event?.device_id || event?.device?.imei || event?.device?.name || 'unknown'
  );
  const time = normalizeKeyPart(event?.server_time || event?.upload_at || event?.time || '');
  if (!device && !time) return null;
  return `device-time:${device}|${time}`;
};

const mergeIncrementalEvents = (events, rangeMeta) => {
  if (rangeMeta?.isFullSync) {
    integratorIncrementalState.eventsByKey.clear();
  }

  (events || []).forEach((event) => {
    const key = getIntegratorEventKey(event);
    if (!key) return;
    integratorIncrementalState.eventsByKey.set(key, event);
  });

  integratorIncrementalState.localDate = rangeMeta?.today || formatDateLocal(new Date());
  integratorIncrementalState.lastRangeEnd = rangeMeta?.rangeEnd || null;
  if (rangeMeta?.isFullSync) {
    integratorIncrementalState.lastFullSyncAt = new Date().toISOString();
  }
};

const mergeAreaFilterDebugEntries = (events, entries, rangeMeta) => {
  if (rangeMeta?.isFullSync) {
    integratorIncrementalState.filterDebugByKey.clear();
  }

  (events || []).forEach((event, index) => {
    const key = getIntegratorEventKey(event) || `${index}`;
    const entry = entries?.[index];
    if (!entry) return;
    // Move-to-end behavior keeps the most recently seen entries at the tail.
    integratorIncrementalState.filterDebugByKey.delete(key);
    integratorIncrementalState.filterDebugByKey.set(key, entry);
  });

  const mergedEntries = Array.from(integratorIncrementalState.filterDebugByKey.values());
  const total = mergedEntries.length;
  const kept = mergedEntries.filter((item) => item.decision === 'KEPT').length;
  setAreaFilterDebugState(mergedEntries, total, kept);
};

const getMergedSortedEvents = () =>
  Array.from(integratorIncrementalState.eventsByKey.values()).sort((a, b) => {
    const aTime = new Date(a?.server_time || a?.upload_at || a?.time || 0).getTime();
    const bTime = new Date(b?.server_time || b?.upload_at || b?.time || 0).getTime();
    return bTime - aTime;
  });
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
  const minutes = getEventLocalMinutes(event);
  const shiftInfo = getEventShiftInfo(area, minutes);
  const activeShiftInfo = getActiveShiftInfo(area);
  const result = shouldKeepEventForActiveShift(area, shiftInfo, activeShiftInfo);

  if (config.debugIntegrator) {
    const timeStr = event?.time || event?.device_time || event?.server_time || 'N/A';
    const unitId = event?.device?.name || event?.device_id || 'Unknown';
    const decision = result ? 'KEPT' : 'DROPPED';
    const reason = result
      ? `matches active ${shiftInfo.shiftLabel || 'shift'}`
      : `outside active shift (event: ${shiftInfo.shiftLabel || '-'}, current: ${activeShiftInfo.shiftLabel || '-'})`;

    console.log(
      `[filter-check] ${decision} | Unit: ${unitId}, Time: ${timeStr}, Reason: ${reason}`
    );
  }

  return result;
};

const buildFilterDebugEntry = (event) => {
  const area = inferAreaFromEvent(event, event?.device || {});
  const minutes = getEventLocalMinutes(event);
  const shiftInfo = getEventShiftInfo(area, minutes);
  const activeShiftInfo = getActiveShiftInfo(area);
  const kept = shouldKeepEventForActiveShift(area, shiftInfo, activeShiftInfo);
  const timeStr = event?.time || event?.device_time || event?.server_time || 'N/A';
  const unitId = event?.device?.name || event?.device_id || 'Unknown';

  return {
    decision: kept ? 'KEPT' : 'DROPPED',
    unit: unitId,
    time: timeStr,
    area,
    shift: shiftInfo.shiftLabel,
    window: shiftInfo.windowLabel,
    activeShift: activeShiftInfo.shiftLabel,
    activeWindow: activeShiftInfo.windowLabel,
    reason: kept
      ? `matches active ${shiftInfo.shiftLabel || 'shift'}`
      : `outside active shift (event: ${shiftInfo.shiftLabel || '-'}, current: ${activeShiftInfo.shiftLabel || '-'})`
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
  if (authState.loginPromise) {
    return authState.loginPromise;
  }

  authState.loginPromise = (async () => {
  const loginUrl = resolveLoginUrl();
  if (!loginUrl) {
    throw new Error('INTEGRATOR_LOGIN_URL is not set');
  }
  if (!config.integrator.username || !config.integrator.password) {
    throw new Error('INTEGRATOR_USERNAME or INTEGRATOR_PASSWORD is missing');
  }

  logIntegratorDebug('Login', { url: loginUrl, username: config.integrator.username });

  const responseMeta = await fetchWithRetry(
    loginUrl,
    config.integrator.requestTimeoutMs || config.sensorApiTimeoutMs,
    {
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
  }
  );

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
  })();

  try {
    return await authState.loginPromise;
  } finally {
    authState.loginPromise = null;
  }
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

const normalizeEventTimestampText = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (DATE_TIME_TEXT_REGEX.test(text)) {
    return text.replace(' ', 'T');
  }
  const timeOnlyMatch = text.match(TIME_ONLY_TEXT_REGEX);
  if (timeOnlyMatch) {
    return `${getTodayLocal()}T${timeOnlyMatch[1]}:${timeOnlyMatch[2]}:${timeOnlyMatch[3] || '00'}`;
  }
  return text;
};

const TIME_ONLY_TEXT_REGEX = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const parseDateAndTimeFromEvent = (value) => {
  if (!value) return { date: null, time: null };
  const text = String(value).trim();
  if (!text) return { date: null, time: null };

  const match = text.match(DATE_TIME_TEXT_REGEX);
  if (match) {
    return {
      date: `${match[1]}-${match[2]}-${match[3]}`,
      time: `${match[4]}:${match[5]}:${match[6] || '00'}`
    };
  }

  const timeOnly = text.match(TIME_ONLY_TEXT_REGEX);
  if (timeOnly) {
    return {
      date: getTodayLocal(),
      time: `${timeOnly[1]}:${timeOnly[2]}:${timeOnly[3] || '00'}`
    };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return { date: null, time: null };
  }

  return {
    date: formatDateLocal(parsed.toISOString()),
    time: formatTimeLocal(parsed.toISOString())
  };
};

const isValidTimestampValue = (value) => {
  const normalized = normalizeEventTimestampText(value);
  if (!normalized) return false;
  return !Number.isNaN(new Date(normalized).getTime());
};

const resolvePreferredEventTime = (event) => {
  const candidates = [
    event.time,
    event.server_time,
    event.upload_at
  ];

  for (const candidate of candidates) {
    const dateTime = parseDateAndTimeFromEvent(candidate);
    if (!dateTime.date || !dateTime.time) continue;
    if (!isValidTimestampValue(candidate)) continue;
    return {
      timestamp: normalizeEventTimestampText(candidate),
      date: dateTime.date,
      time: dateTime.time
    };
  }

  return { timestamp: null, date: null, time: null };
};

const mapIntegratorEventToReading = (event) => {
  const device = event.device || {};
  const sensorId = device.imei || device.name || event.device_id || event.id;
  const status = event.is_followed_up ? 'Followed Up' : 'Open';
  const speed = Number.isFinite(Number(event.speed)) ? Number(event.speed) : null;
  const manualVerificationTime = event.manual_verification_time || event.manualVerificationTime || null;
  const fallbackEventTime = event.server_time || event.upload_at || event.time;
  const preferredEventTime = resolvePreferredEventTime(event);
  const timestamp =
    preferredEventTime.timestamp || new Date().toISOString();
  const area = inferAreaFromEvent(event, device);
  const shiftInfo = getEventShiftInfo(area, getEventLocalMinutes(event));
  const isWithinShift =
    typeof event?._isWithinShift === 'boolean'
      ? event._isWithinShift
      : shiftInfo.isWithinShift;
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
      date: preferredEventTime.date || undefined,
      time: preferredEventTime.time || undefined,
      speed: speed !== null ? `${speed} km/h` : undefined,
      count: 1,
      status,
      alarmType: event.alarm_type,
      alarmLevel: event.level,
      shiftLabel: shiftInfo.shiftLabel || null,
      manualVerificationTime: manualVerificationTime || undefined,
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
    return new URL('/api/v1/devices-all?search=', base).toString();
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
  enforceShiftCutoff();

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

  const rangeMeta = resolveIncrementalRange();
  const payload = buildIntegratorPayload(1, rangeMeta);
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
    rangeMode: rangeMeta.reason,
    payload: redactPayload(payload)
  });

  let responseMeta;
  try {
    responseMeta = await fetchWithRetry(
      config.integrator.baseUrl,
      config.integrator.requestTimeoutMs || config.sensorApiTimeoutMs,
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
      responseMeta = await fetchWithRetry(
        config.integrator.baseUrl,
        config.integrator.requestTimeoutMs || config.sensorApiTimeoutMs,
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
  enqueueRawEvents(list);
  const pagination = data?.data?.pagination;

  if (
    config.integrator.fetchAllPages &&
    pagination?.total_pages &&
    pagination.total_pages > 1
  ) {
    const totalPagesReported = Number(pagination.total_pages);
    const maxPages = Number(config.integrator.maxPages);
    const hasExplicitPageCap = Number.isFinite(maxPages) && maxPages > 0;
    const totalPages = hasExplicitPageCap
      ? Math.min(totalPagesReported, maxPages)
      : totalPagesReported;

    if (hasExplicitPageCap && totalPagesReported > maxPages) {
      console.warn(
        `[integrator] Page fetch capped at ${maxPages} of ${totalPagesReported}. ` +
          'Increase INTEGRATOR_MAX_PAGES or set 0 for unlimited.'
      );
    }

    for (let page = 2; page <= totalPages; page += 1) {
      const pagePayload = buildIntegratorPayload(page, rangeMeta);
      logIntegratorDebug('Request', {
        url: config.integrator.baseUrl,
        authMode: config.integrator.authMode,
        rangeMode: rangeMeta.reason,
        payload: redactPayload(pagePayload)
      });

      const pageResponse = await fetchWithRetry(
        config.integrator.baseUrl,
        config.integrator.requestTimeoutMs || config.sensorApiTimeoutMs,
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
  mergeAreaFilterDebugEntries(list, filterEntries, rangeMeta);
  logIntegratorDebug('Area window filter', {
    total: getAreaFilterDebugState().total,
    kept: getAreaFilterDebugState().kept
  });

  mergeIncrementalEvents(filteredList, rangeMeta);
  const mergedEvents = getMergedSortedEvents();

  logIntegratorDebug('Incremental state', {
    mode: rangeMeta.reason,
    rangeStart: rangeMeta.rangeStart,
    rangeEnd: rangeMeta.rangeEnd,
    batchKept: filteredList.length,
    mergedTotal: mergedEvents.length
  });

  return mergedEvents.map(mapIntegratorEventToReading);
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
    responseMeta = await fetchWithRetry(
      devicesUrl,
      config.integrator.requestTimeoutMs || config.sensorApiTimeoutMs,
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
      responseMeta = await fetchWithRetry(
        devicesUrl,
        config.integrator.requestTimeoutMs || config.sensorApiTimeoutMs,
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
  getAreaFilterDebugState,
  enforceShiftCutoff,
  getCurrentShiftCutoffKey,
  drainPendingRawEvents
};
