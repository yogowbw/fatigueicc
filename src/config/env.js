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

const toOptionalString = (value, fallback) =>
  value === undefined ? fallback : value;

const toList = (value, fallback = '') =>
  (value ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

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
  fatigueTypes: (process.env.FATIGUE_TYPES || 'Eyes Closing,Yawning')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  areaMapping: {
    haulingGroupKeywords: toList(
      process.env.HAULING_GROUP_KEYWORDS,
      'hauling'
    ),
    miningGroupKeywords: toList(process.env.MINING_GROUP_KEYWORDS, 'mining'),
    haulingUnitPrefixes: toList(
      process.env.HAULING_UNIT_PREFIXES,
      'HD,WT'
    ),
    miningUnitPrefixes: toList(
      process.env.MINING_UNIT_PREFIXES,
      'DT,EX'
    )
  },
  deviceHealthMode:
    process.env.DEVICE_HEALTH_MODE ||
    (process.env.INTEGRATOR_BASE_URL ? 'mock' : 'cache'),
  deviceHealth: {
    total: toInt(process.env.DEVICE_HEALTH_TOTAL, 142),
    online: toInt(process.env.DEVICE_HEALTH_ONLINE, 135),
    offline: toInt(process.env.DEVICE_HEALTH_OFFLINE, 7),
    coverage: toInt(process.env.DEVICE_HEALTH_COVERAGE, 95)
  },
  devicePollIntervalMs: toInt(process.env.DEVICE_POLL_INTERVAL_MS, 10000),
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
    authHeader: process.env.INTEGRATOR_AUTH_HEADER || '',
    xToken: process.env.INTEGRATOR_XTOKEN || '',
    accessToken: process.env.INTEGRATOR_ACCESS_TOKEN || '',
    loginUrl: process.env.INTEGRATOR_LOGIN_URL || '',
    devicesUrl: process.env.INTEGRATOR_DEVICES_URL || '',
    pageSize: toInt(process.env.INTEGRATOR_PAGE_SIZE, 50),
    fetchAllPages: toBool(process.env.INTEGRATOR_FETCH_ALL_PAGES, true),
    maxPages: toInt(process.env.INTEGRATOR_MAX_PAGES, 20),
    filterColumns: toOptionalString(
      process.env.INTEGRATOR_FILTER_COLUMNS,
      'manual_verification_is_true_alarm,level'
    ),
    filterValue: toOptionalString(process.env.INTEGRATOR_FILTER_VALUE, 'true|3'),
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
