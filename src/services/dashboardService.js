const { config } = require('../config/env');
const { sql, getPool } = require('../db/sqlServer');
const { QUERY_SENSOR_HISTORY, QUERY_LAST_READING } = require('../db/queries');

const formatTimeLocal = (isoString) => {
  const date = isoString ? new Date(isoString) : new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

const formatDateLocal = (isoString) => {
  const date = isoString ? new Date(isoString) : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

const getTodayLocal = () => formatDateLocal();

const normalizeAlertStatus = (reading) => {
  const status = String(reading.status || '').toLowerCase();
  if (status === 'open' || status === 'followed up') {
    return reading.status;
  }
  if (status === 'offline') {
    return 'Open';
  }
  if (Number.isFinite(Number(reading.value)) && Number(reading.value) >= config.alertThreshold) {
    return 'Open';
  }
  return 'Followed Up';
};

const inferArea = (sensorId, meta) => {
  if (meta && meta.area) return meta.area;
  if (!sensorId) return 'Mining';
  return sensorId.startsWith('HD') || sensorId.startsWith('WT') ? 'Hauling' : 'Mining';
};

const toAlert = (reading) => {
  const meta = reading.meta || {};
  const area = inferArea(reading.sensorId, meta);
  const location =
    meta.location || (area === 'Mining' ? 'Manado - Front A' : 'KM 10');
  const speed =
    meta.speed ||
    `${Math.max(0, Math.round(Number(reading.value) || 0))} km/h`;
  const metaStatus = meta.status && String(meta.status).toLowerCase();
  const alertStatus =
    metaStatus === 'open' || metaStatus === 'followed up'
      ? meta.status
      : normalizeAlertStatus(reading);
  const operator = meta.driver || meta.operator || 'Unknown Driver';
  const fatigue = meta.fatigue || meta.type || 'Fatigue';

  return {
    id: meta.id || reading.sensorId,
    unit: meta.unit || reading.sensorId,
    operator,
    type: meta.type || 'Fatigue',
    fatigue,
    photoUrl: meta.photoUrl || null,
    area,
    location,
    latitude:
      Number.isFinite(Number(meta.latitude)) ? Number(meta.latitude) : null,
    longitude:
      Number.isFinite(Number(meta.longitude)) ? Number(meta.longitude) : null,
    time: meta.time || formatTimeLocal(reading.timestamp),
    date: meta.date || getTodayLocal(),
    status: alertStatus,
    speed,
    count: meta.count || 1,
    timestamp: reading.timestamp,
    sensorId: reading.sensorId
  };
};

const computeDeviceHealth = (readings) => {
  const total = config.sensorIds.length || readings.length;
  const offlineReported = readings.filter(
    (reading) => String(reading.status || '').toLowerCase() === 'offline'
  ).length;
  const missing = Math.max(0, total - readings.length);
  const offline = offlineReported + missing;
  const online = Math.max(0, total - offline);
  const coverage = total > 0 ? Math.round((online / total) * 100) : 0;

  return { total, online, offline, coverage };
};

const resolveDeviceHealth = (readings) => {
  if (config.deviceHealthMode === 'mock') {
    const total = config.deviceHealth.total;
    const online = config.deviceHealth.online;
    const offline =
      Number.isFinite(config.deviceHealth.offline)
        ? config.deviceHealth.offline
        : Math.max(0, total - online);
    const coverage = Number.isFinite(config.deviceHealth.coverage)
      ? config.deviceHealth.coverage
      : total > 0
        ? Math.round((online / total) * 100)
        : 0;

    return { total, online, offline, coverage };
  }

  return computeDeviceHealth(readings);
};

const computeStats = (alerts) => {
  const totalToday = alerts.length;
  const activeOpen = alerts.filter((alert) => alert.status === 'Open').length;
  const followedUpToday = alerts.filter(
    (alert) => alert.status === 'Followed Up'
  ).length;

  return { totalToday, followedUpToday, activeOpen };
};

const computeAreaSummary = (alerts) => {
  const summary = {
    Mining: { open: 0, resolved: 0, total: 0 },
    Hauling: { open: 0, resolved: 0, total: 0 }
  };

  alerts.forEach((alert) => {
    if (!summary[alert.area]) return;
    summary[alert.area].total += 1;
    if (alert.status === 'Open') {
      summary[alert.area].open += 1;
    } else {
      summary[alert.area].resolved += 1;
    }
  });

  return summary;
};

const computeLocationStats = (alerts) => {
  const stats = { Mining: {}, Hauling: {} };
  alerts
    .filter((alert) => alert.status === 'Open')
    .forEach((alert) => {
      if (!stats[alert.area]) return;
      stats[alert.area][alert.location] =
        (stats[alert.area][alert.location] || 0) + 1;
    });

  return stats;
};

const computeHighRiskOperators = (alerts) => {
  const operatorMap = {};
  alerts.forEach((alert) => {
    const key = alert.operator || 'Unknown Operator';
    if (!operatorMap[key]) {
      operatorMap[key] = {
        name: alert.operator || 'Unknown Operator',
        unit: alert.unit,
        events: 0,
        status: 'Active'
      };
    }
    operatorMap[key].events += alert.count || 1;
  });

  return Object.values(operatorMap)
    .filter((op) => op.events > 1)
    .sort((a, b) => b.events - a.events);
};

const computeHighRiskZones = (alerts) => {
  const zoneMap = {};
  alerts.forEach((alert) => {
    const key = alert.location || 'Unknown';
    if (!zoneMap[key]) {
      zoneMap[key] = { location: key, count: 0, area: alert.area };
    }
    zoneMap[key].count += 1;
  });

  return Object.values(zoneMap).sort((a, b) => b.count - a.count);
};

const computeOverdueAlerts = (alerts, now) => {
  const current = now || new Date();
  return alerts.filter((alert) => {
    if (alert.status !== 'Open') return false;
    const [hours, minutes, seconds] = (alert.time || '00:00:00')
      .split(':')
      .map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
    const eventTime = new Date(current);
    eventTime.setHours(hours, minutes, seconds || 0, 0);
    const diffMinutes = Math.floor((current - eventTime) / 60000);
    return diffMinutes > 30;
  });
};

const parseMeta = (metaValue) => {
  if (!metaValue) return {};
  try {
    return typeof metaValue === 'string' ? JSON.parse(metaValue) : metaValue;
  } catch (error) {
    return {};
  }
};

const fetchSensorHistory = async (sensorId) => {
  const pool = await getPool();
  const request = pool.request();
  request.input('sensorId', sql.VarChar(50), sensorId);
  request.input('lookbackMinutes', sql.Int, config.historyLookbackMinutes);
  request.input('limit', sql.Int, config.historyLimit);

  const result = await request.query(QUERY_SENSOR_HISTORY);

  return result.recordset.map((row) => ({
    sensorId: row.sensorId,
    status: row.status,
    value: row.value,
    recordedAt: row.recordedAt,
    receivedAt: row.receivedAt,
    source: row.source,
    meta: parseMeta(row.meta)
  }));
};

const fetchLastReading = async (sensorId) => {
  const pool = await getPool();
  const request = pool.request();
  request.input('sensorId', sql.VarChar(50), sensorId);

  const result = await request.query(QUERY_LAST_READING);
  const row = result.recordset[0];
  if (!row) return null;

  return {
    sensorId: row.sensorId,
    status: row.status,
    value: row.value,
    timestamp: row.recordedAt,
    receivedAt: row.receivedAt,
    source: row.source || 'historical',
    meta: parseMeta(row.meta)
  };
};

const createDashboardService = ({ cache, eventCache, pollingStatus }) => {
  const getOverview = async () => {
    const snapshot = cache.getSnapshot();
    const sensors = snapshot.sensors;
    const eventReadings = eventCache ? eventCache.getAll() : sensors;
    const alerts = eventReadings.map(toAlert);
    const now = new Date();

    return {
      meta: {
        serverTime: now.toISOString(),
        serverDate: getTodayLocal(),
        refreshMs: config.sensorPollIntervalMs,
        polling: pollingStatus ? pollingStatus() : null,
        eventCount: eventReadings.length
      },
      deviceHealth: resolveDeviceHealth(sensors),
      sensors,
      alerts,
      stats: computeStats(alerts),
      areaSummary: computeAreaSummary(alerts),
      locationStats: computeLocationStats(alerts),
      highRiskOperators: computeHighRiskOperators(alerts),
      highRiskZones: computeHighRiskZones(alerts),
      overdueAlerts: computeOverdueAlerts(alerts, now)
    };
  };

  const getSensorDetail = async (sensorId) => {
    let sensor = cache.get(sensorId);
    let source = 'cache';

    if (!sensor) {
      const fallback = await fetchLastReading(sensorId);
      if (fallback) {
        sensor = {
          ...fallback,
          timestamp: fallback.timestamp
            ? new Date(fallback.timestamp).toISOString()
            : new Date().toISOString()
        };
        source = 'historical';
      }
    }

    const history = await fetchSensorHistory(sensorId);

    return {
      meta: {
        serverTime: new Date().toISOString(),
        serverDate: getTodayLocal(),
        lookbackMinutes: config.historyLookbackMinutes,
        source
      },
      sensor,
      alert: sensor ? toAlert(sensor) : null,
      history
    };
  };

  return { getOverview, getSensorDetail };
};

module.exports = { createDashboardService };
