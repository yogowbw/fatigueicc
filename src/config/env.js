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

const buildShiftDefinition = (name, start, end) => ({
  name,
  start,
  end
});

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
    : defaultSensorIds.join(',');

const sensorIds = sensorIdsSource
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

const sqlServerEnv = process.env.SQL_SERVER || 'localhost';
const sqlServerParts = sqlServerEnv.split(',');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  sensorApiBaseUrl: process.env.SENSOR_API_BASE_URL || '',
  sensorApiTimeoutMs: toInt(process.env.SENSOR_API_TIMEOUT_MS, 2000),
  sensorPollIntervalMs: toInt(process.env.SENSOR_POLL_INTERVAL_MS, 5000),
  persistIntervalMs: toInt(process.env.PERSIST_INTERVAL_MS, 60000),
  jobs: {
    enableRealtimePolling: toBool(process.env.ENABLE_REALTIME_POLLING, true),
    enableDevicePolling: toBool(process.env.ENABLE_DEVICE_POLLING, true),
    enablePersistenceJob: toBool(process.env.ENABLE_PERSISTENCE_JOB, true)
  },
  historyLookbackMinutes: toInt(process.env.HISTORY_LOOKBACK_MINUTES, 60),
  historyLimit: toInt(process.env.HISTORY_LIMIT, 200),
  alertThreshold: Number.isFinite(Number(process.env.ALERT_THRESHOLD))
    ? Number(process.env.ALERT_THRESHOLD)
    : 75,
  timeZone: process.env.TIME_ZONE || 'Asia/Makassar',
  defaultArea: process.env.DEFAULT_AREA || 'Mining',
  defaultMiningLocation: process.env.DEFAULT_MINING_LOCATION || 'Manado - Front A',
  defaultHaulingLocation: process.env.DEFAULT_HAULING_LOCATION || 'KM 10',
  fatigueTypes: (process.env.FATIGUE_TYPES || 'Eyes Closing,Yawning')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  areaWindows: {
    Mining: {
      start: process.env.MINING_WINDOW_START || '06:00',
      end: process.env.MINING_WINDOW_END || '18:00'
    },
    Hauling: {
      start: process.env.HAULING_WINDOW_START || '05:00',
      end: process.env.HAULING_WINDOW_END || '17:00'
    }
  },
  areaShifts: {
    Mining: [
      buildShiftDefinition(
        'Shift 1',
        process.env.MINING_SHIFT1_START || '06:00',
        process.env.MINING_SHIFT1_END || '17:59'
      ),
      buildShiftDefinition(
        'Shift 2',
        process.env.MINING_SHIFT2_START || '18:00',
        process.env.MINING_SHIFT2_END || '05:59'
      )
    ],
    Hauling: [
      buildShiftDefinition(
        'Shift 1',
        process.env.HAULING_SHIFT1_START || '05:00',
        process.env.HAULING_SHIFT1_END || '16:59'
      ),
      buildShiftDefinition(
        'Shift 2',
        process.env.HAULING_SHIFT2_START || '17:00',
        process.env.HAULING_SHIFT2_END || '04:59'
      )
    ]
  },
  areaMapping: {
    haulingGroupKeywords: toList(
      process.env.HAULING_GROUP_KEYWORDS,
      'hauling'
    ),
    miningGroupKeywords: toList(process.env.MINING_GROUP_KEYWORDS, 'mining'),
    haulingUnitPrefixes: toList(
      process.env.HAULING_UNIT_PREFIXES,
      'HD,WT,H'
    ),
    miningUnitPrefixes: toList(
      process.env.MINING_UNIT_PREFIXES,
      'DT,EX'
    ),
    haulingLocationPrefixes: toList(
      process.env.HAULING_LOCATION_PREFIXES,
      'KM'
    ),
    miningLocationPrefixes: toList(
      process.env.MINING_LOCATION_PREFIXES,
      ''
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
  sensorApiMode: process.env.SENSOR_API_MODE || 'real',
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
    devicesGroupedUrl: process.env.INTEGRATOR_DEVICES_GROUPED_URL || '',
    pageSize: toInt(process.env.INTEGRATOR_PAGE_SIZE, 50),
    fetchAllPages: toBool(process.env.INTEGRATOR_FETCH_ALL_PAGES, true),
    // 0 or negative means unlimited pages (follow integrator total_pages).
    maxPages: toInt(process.env.INTEGRATOR_MAX_PAGES, 0),
    requestTimeoutMs: toInt(
      process.env.INTEGRATOR_REQUEST_TIMEOUT_MS,
      toInt(process.env.INTEGRATOR_TIMEOUT_MS, 8000)
    ),
    maxFilterDebugEntries: toInt(process.env.INTEGRATOR_MAX_FILTER_DEBUG_ENTRIES, 200),
    requestRetries: Math.max(0, toInt(process.env.INTEGRATOR_REQUEST_RETRIES, 1)),
    retryDelayMs: Math.max(0, toInt(process.env.INTEGRATOR_RETRY_DELAY_MS, 400)),
    incrementalEnabled: toBool(process.env.INTEGRATOR_INCREMENTAL_ENABLED, true),
    incrementalOverlapSeconds: Math.max(
      0,
      toInt(process.env.INTEGRATOR_INCREMENTAL_OVERLAP_SECONDS, 90)
    ),
    fullResyncMinutes: Math.max(1, toInt(process.env.INTEGRATOR_FULL_RESYNC_MINUTES, 30)),
    rangeStartTime: process.env.INTEGRATOR_RANGE_START_TIME || '00:00:00',
    rangeEndTime: process.env.INTEGRATOR_RANGE_END_TIME || '',
    rangeEndMode: process.env.INTEGRATOR_RANGE_END_MODE || 'now',
    filterColumns: toOptionalString(
      process.env.INTEGRATOR_FILTER_COLUMNS,
      'alarm_type,manual_verification_is_true_alarm,level'
    ),
    filterValue: toOptionalString(process.env.INTEGRATOR_FILTER_VALUE, '122,121|true|3')
  },
  debugIntegrator: toBool(process.env.INTEGRATOR_DEBUG, false),
  sql: {
    connectionString: process.env.SQL_CONNECTION_STRING || '',
    user: process.env.SQL_USER || 'yogo',
    password: process.env.SQL_PASSWORD || 'P@$$w0rd123!@#',
    server: sqlServerParts[0],
    database: process.env.SQL_DATABASE || 'icc',
    port: toInt(sqlServerParts[1], 1433),
    options: {
      // For SQL MI, encrypt should be true and trustServerCertificate should be false.
      // We default to these secure settings for production environments.
      encrypt: toBool(process.env.SQL_ENCRYPT, process.env.NODE_ENV === 'production'),
      trustServerCertificate: toBool(process.env.SQL_TRUST_CERT, process.env.NODE_ENV !== 'production')
    }
  }
};

module.exports = { config };
