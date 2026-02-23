const { config } = require('../config/env');
const { sql, getPool } = require('../db/sqlServer');
const { getEventKey } = require('../cache/eventCache');
const {
  getCurrentShiftCutoffKey,
  drainPendingRawEvents
} = require('./sensorApiClient');
const crypto = require('crypto');

const buildBulkTable = (readings) => {
  const table = new sql.Table('sensor_readings');
  table.create = false;

  table.columns.add('sensor_id', sql.VarChar(50), { nullable: false });
  table.columns.add('status', sql.VarChar(20), { nullable: false });
  table.columns.add('value', sql.Float, { nullable: true });
  table.columns.add('recorded_at', sql.DateTime2(3), { nullable: false });
  table.columns.add('received_at', sql.DateTime2(3), { nullable: false });
  table.columns.add('source', sql.VarChar(20), { nullable: false });
  table.columns.add('meta', sql.NVarChar(sql.MAX), { nullable: true });

  readings.forEach((reading) => {
    table.rows.add(
      reading.sensorId,
      reading.status || 'unknown',
      Number.isFinite(Number(reading.value)) ? Number(reading.value) : null,
      new Date(reading.timestamp),
      new Date(reading.receivedAt || reading.timestamp),
      reading.source || 'cache',
      reading.meta ? JSON.stringify(reading.meta) : null
    );
  });

  return table;
};

const persistState = {
  persistedIds: new Set(),
  persistedQueue: [],
  currentShiftKey: null,
  tableColumnsCache: new Map(),
  missingTableWarnings: new Set()
};

const DATE_TIME_TEXT_REGEX =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/;
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

const trackPersistedId = (id) => {
  if (!id || persistState.persistedIds.has(id)) return;
  persistState.persistedIds.add(id);
  persistState.persistedQueue.push(id);
  if (persistState.persistedQueue.length > 10000) {
    const oldest = persistState.persistedQueue.shift();
    persistState.persistedIds.delete(oldest);
  }
};

const resetPersistedEventIds = () => {
  persistState.persistedIds.clear();
  persistState.persistedQueue = [];
};

const parseDateTimeTextToUtcDate = (value) => {
  const text = String(value || '').trim();
  const match = text.match(DATE_TIME_TEXT_REGEX);
  if (!match) return null;
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
      0
    )
  );
};

const toUtcDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;

  const fromText = parseDateTimeTextToUtcDate(value);
  if (fromText) return fromText;

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
};

const toWitaDate = (value) => {
  const utcDate = toUtcDate(value);
  if (!utcDate) return null;
  return new Date(utcDate.getTime() + WITA_OFFSET_MS);
};

const normalizeDbValue = (value) => {
  if (value === undefined) return null;
  return value;
};

const getAreaShifts = (area) => {
  const shifts = config.areaShifts?.[area];
  return Array.isArray(shifts) ? shifts : [];
};

const toMinutes = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const parts = text.split(':').map((part) => Number(part));
  const hours = parts[0];
  const minutes = parts[1];
  const seconds = Number.isFinite(parts[2]) ? parts[2] : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes + seconds / 60;
};

const isWithinWindow = (minutes, shift) => {
  const start = toMinutes(shift?.start);
  const end = toMinutes(shift?.end);
  if (!Number.isFinite(minutes) || start === null || end === null) return false;
  if (start <= end) return minutes >= start && minutes <= end;
  return minutes >= start || minutes <= end;
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

const resolveActiveShiftLabel = (area, now = new Date()) => {
  const shifts = getAreaShifts(area);
  if (shifts.length === 0) return null;
  const currentMinutes = getLocalClockMinutes(now);
  if (!Number.isFinite(currentMinutes)) return null;
  const matched = shifts.find((shift) => isWithinWindow(currentMinutes, shift));
  return matched?.name || null;
};

const resolveShiftDefinition = (area, shiftLabel) => {
  const shifts = getAreaShifts(area);
  const matched = shifts.find((shift) => shift?.name === shiftLabel);
  if (matched) return matched;
  return shifts[0] || null;
};

const getTableColumns = async (pool, tableName) => {
  if (persistState.tableColumnsCache.has(tableName)) {
    return persistState.tableColumnsCache.get(tableName);
  }

  const result = await pool
    .request()
    .input('tableName', sql.VarChar(128), tableName)
    .query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @tableName
    `);

  const columns = new Set(result.recordset.map((row) => row.COLUMN_NAME));
  persistState.tableColumnsCache.set(tableName, columns);
  return columns;
};

const insertRowsDynamic = async (pool, tableName, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  let columns;
  try {
    columns = await getTableColumns(pool, tableName);
  } catch (error) {
    const key = `${tableName}:metadata`;
    if (!persistState.missingTableWarnings.has(key)) {
      console.warn(`[persist] Skip ${tableName}: unable to read table metadata (${error.message || error})`);
      persistState.missingTableWarnings.add(key);
    }
    return 0;
  }

  if (!columns || columns.size === 0) {
    const key = `${tableName}:empty`;
    if (!persistState.missingTableWarnings.has(key)) {
      console.warn(`[persist] Skip ${tableName}: table not found or has no columns.`);
      persistState.missingTableWarnings.add(key);
    }
    return 0;
  }

  let inserted = 0;
  for (const row of rows) {
    const entries = Object.entries(row).filter(([columnName]) => columns.has(columnName));
    if (entries.length === 0) continue;

    const request = pool.request();
    const columnSql = entries.map(([columnName]) => `[${columnName}]`).join(', ');
    const valueSql = entries
      .map(([_columnName, _value], index) => `@p${index}`)
      .join(', ');

    entries.forEach(([_columnName, value], index) => {
      request.input(`p${index}`, normalizeDbValue(value));
    });

    await request.query(`INSERT INTO [dbo].[${tableName}] (${columnSql}) VALUES (${valueSql})`);
    inserted += 1;
  }

  return inserted;
};

const buildRawRows = (events) => {
  const now = new Date();

  return (events || []).map((event) => {
    const eventJson = JSON.stringify(event || {});
    return {
      ingest_time_utc: now,
      source_system: 'integrator',
      api_endpoint: config.integrator.baseUrl || null,
      payload_json: eventJson,
      payload_hash: crypto.createHash('sha256').update(eventJson).digest(),
      event_id: event?.id ? String(event.id) : null,
      identity_key: event?.identity ? String(event.identity) : null,
      device_id: event?.device_id || event?.device?.imei || event?.device?.name || null,
      server_time_raw: event?.server_time || null,
      device_time_raw: event?.device_time || event?.time || null
    };
  });
};

const buildHistoryRows = (readings) => {
  const snapshotTimeUtc = new Date();
  const snapshotTimeWita = toWitaDate(snapshotTimeUtc);

  return (readings || []).map((reading) => {
    const meta = reading?.meta || {};
    const area = meta.area || config.defaultArea || 'Mining';
    const shiftLabel = meta.shiftLabel || null;
    const shiftDefinition = resolveShiftDefinition(area, shiftLabel);
    const activeShiftLabel = resolveActiveShiftLabel(area, snapshotTimeUtc);
    const eventTimeUtc = toUtcDate(reading?.timestamp);
    const eventTimeWita = toWitaDate(eventTimeUtc);
    const manualVerificationTimeRaw = meta.manualVerificationTime || null;
    const manualVerificationUtc = toUtcDate(manualVerificationTimeRaw);
    const manualVerificationWita = toWitaDate(manualVerificationUtc);

    return {
      snapshot_time_utc: snapshotTimeUtc,
      snapshot_time_wita: snapshotTimeWita,
      event_id: meta.id ? String(meta.id) : null,
      identity_key: meta.identity ? String(meta.identity) : null,
      event_time_raw: meta.time || null,
      device_time_raw: meta.time || null,
      server_time_raw: reading?.timestamp || null,
      event_time_utc: eventTimeUtc,
      event_time_wita: eventTimeWita,
      alarm_type: Number.isFinite(Number(meta.alarmType)) ? Number(meta.alarmType) : null,
      alarm_name: meta.fatigue || meta.type || null,
      alarm_level: Number.isFinite(Number(meta.alarmLevel)) ? Number(meta.alarmLevel) : null,
      speed: Number.isFinite(Number(reading?.value)) ? Number(reading.value) : null,
      latitude: Number.isFinite(Number(meta.latitude)) ? Number(meta.latitude) : null,
      longitude: Number.isFinite(Number(meta.longitude)) ? Number(meta.longitude) : null,
      is_followed_up:
        typeof reading?.status === 'string'
          ? reading.status.toLowerCase() === 'followed up'
          : null,
      manual_verification_time_raw: manualVerificationTimeRaw,
      manual_verification_time_utc: manualVerificationUtc,
      manual_verification_time_wita: manualVerificationWita,
      manual_verification_by: meta.operator || null,
      manual_true_alarm: null,
      device_id: meta.deviceId || null,
      unit_name: meta.unit || reading?.sensorId || null,
      imei: meta.imei || null,
      group_name: meta.groupName || null,
      driver_name: meta.driver || null,
      geofence_name: meta.location || null,
      area,
      sub_area: meta.location || null,
      shift_label: shiftLabel,
      shift_start_wita: shiftDefinition?.start ? `${shiftDefinition.start}:00` : null,
      shift_end_wita: shiftDefinition?.end ? `${shiftDefinition.end}:00` : null,
      is_active_shift_now:
        shiftLabel && activeShiftLabel ? shiftLabel === activeShiftLabel : null,
      source_system: reading?.source || 'integrator',
      raw_id: null,
      payload_json: meta ? JSON.stringify(meta) : null
    };
  });
};

const getReadingsForPersist = (cache, eventsCache) => {
  if (config.sensorApiMode === 'integrator' && eventsCache) {
    const readings = eventsCache.getAll();
    return readings.filter((reading) => {
      const key = getEventKey(reading);
      return key && !persistState.persistedIds.has(key);
    });
  }

  return cache.getAll();
};

const persistSnapshot = async (cache, eventsCache) => {
  const shiftKey = getCurrentShiftCutoffKey();
  if (
    config.sensorApiMode === 'integrator' &&
    persistState.currentShiftKey &&
    persistState.currentShiftKey !== shiftKey
  ) {
    resetPersistedEventIds();
  }
  persistState.currentShiftKey = shiftKey;

  const readings = getReadingsForPersist(cache, eventsCache);
  const rawEvents = config.sensorApiMode === 'integrator' ? drainPendingRawEvents() : [];
  if (!readings.length && rawEvents.length === 0) {
    return { inserted: 0, rawInserted: 0, historyInserted: 0 };
  }

  const pool = await getPool();
  if (readings.length > 0) {
    const table = buildBulkTable(readings);
    await pool.request().bulk(table);
  }

  let rawInserted = 0;
  let historyInserted = 0;

  if (config.sensorApiMode === 'integrator') {
    try {
      rawInserted = await insertRowsDynamic(pool, 'fatigue_event_raw', buildRawRows(rawEvents));
    } catch (error) {
      console.warn(`[persist] Failed to insert fatigue_event_raw: ${error.message || error}`);
    }

    try {
      historyInserted = await insertRowsDynamic(
        pool,
        'fatigue_event_history',
        buildHistoryRows(readings)
      );
    } catch (error) {
      console.warn(`[persist] Failed to insert fatigue_event_history: ${error.message || error}`);
    }
  }

  if (config.sensorApiMode === 'integrator') {
    readings.forEach((reading) => trackPersistedId(getEventKey(reading)));
  }

  return { inserted: readings.length, rawInserted, historyInserted };
};

const startPersistenceJob = (cache, eventsCache) => {
  let isRunning = false;

  const runOnce = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await persistSnapshot(cache, eventsCache);
    } catch (error) {
      console.error('Failed to persist snapshot:', error.message || error);
    } finally {
      isRunning = false;
    }
  };

  runOnce();
  const timer = setInterval(runOnce, config.persistIntervalMs);

  return () => clearInterval(timer);
};

module.exports = { startPersistenceJob };
