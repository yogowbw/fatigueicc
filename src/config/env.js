const dotenv = require('dotenv');

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const defaultSensorIds = [
  'DT-402',
  'DT-112',
  'DT-555',
  'HD-777',
  'EX-202',
  'DT-315',
  'WT-05',
  'DT-551',
  'DT-101',
  'DT-103'
];

const sensorIdsSource =
  process.env.SENSOR_IDS !== undefined
    ? process.env.SENSOR_IDS
    : process.env.INTEGRATOR_BASE_URL
      ? ''
      : defaultSensorIds.join(',');

const sensorIds = sensorIdsSource
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  sensorApiBaseUrl: process.env.SENSOR_API_BASE_URL || '',
  sensorApiTimeoutMs: toInt(process.env.SENSOR_API_TIMEOUT_MS, 2000),
  sensorPollIntervalMs: toInt(process.env.SENSOR_POLL_INTERVAL_MS, 1000),
  persistIntervalMs: toInt(process.env.PERSIST_INTERVAL_MS, 60000),
  historyLookbackMinutes: toInt(process.env.HISTORY_LOOKBACK_MINUTES, 60),
  historyLimit: toInt(process.env.HISTORY_LIMIT, 200),
  alertThreshold: Number.isFinite(Number(process.env.ALERT_THRESHOLD))
    ? Number(process.env.ALERT_THRESHOLD)
    : 75,
  timeZone: process.env.TIME_ZONE || 'Asia/Jakarta',
  defaultArea: process.env.DEFAULT_AREA || 'Mining',
  sensorApiMode:
    process.env.SENSOR_API_MODE ||
    (process.env.INTEGRATOR_BASE_URL
      ? 'integrator'
      : process.env.SENSOR_API_BASE_URL
        ? 'real'
        : 'mock'),
  sensorIds,
  integrator: {
    baseUrl: process.env.INTEGRATOR_BASE_URL || '',
    username: process.env.INTEGRATOR_USERNAME || '',
    password: process.env.INTEGRATOR_PASSWORD || '',
    authMode: process.env.INTEGRATOR_AUTH_MODE || 'basic',
    pageSize: toInt(process.env.INTEGRATOR_PAGE_SIZE, 50),
    filterColumns: process.env.INTEGRATOR_FILTER_COLUMNS || 'is_followed_up',
    filterValue: process.env.INTEGRATOR_FILTER_VALUE || 'true',
    rangeDateColumn: process.env.INTEGRATOR_RANGE_DATE_COLUMN || 'device_time'
  },
  debugIntegrator: toBool(process.env.INTEGRATOR_DEBUG, false),
  sql: {
    connectionString: process.env.SQL_CONNECTION_STRING || '',
    user: process.env.SQL_USER || 'yogo',
    password: process.env.SQL_PASSWORD || 'P@$$w0rd123!@#',
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'icc',
    options: {
      encrypt: toBool(process.env.SQL_ENCRYPT, false),
      trustServerCertificate: toBool(process.env.SQL_TRUST_CERT, true)
    }
  }
};

module.exports = { config };
