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

const sensorIds = (process.env.SENSOR_IDS || defaultSensorIds.join(','))
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
  sensorApiMode:
    process.env.SENSOR_API_MODE ||
    (process.env.SENSOR_API_BASE_URL ? 'real' : 'mock'),
  sensorIds,
  sql: {
    connectionString: process.env.SQL_CONNECTION_STRING || '',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'YourStrong!Passw0rd',
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'DashboardDB',
    options: {
      encrypt: toBool(process.env.SQL_ENCRYPT, false),
      trustServerCertificate: toBool(process.env.SQL_TRUST_CERT, true)
    }
  }
};

module.exports = { config };
