const {
  parseBoolean,
  parseIntOrDefault,
  parseList,
  sanitizeIdentifier
} = require('./utils/env');

const requiredEnv = ['SQL_SERVER', 'SQL_DATABASE', 'SQL_USER', 'SQL_PASSWORD'];

const config = {
  port: parseIntOrDefault(process.env.PORT, 4000),
  cors: {
    origins: parseList(process.env.CORS_ORIGIN)
  },
  sql: {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    port: parseIntOrDefault(process.env.SQL_PORT, 1433),
    options: {
      encrypt: parseBoolean(process.env.SQL_ENCRYPT, true),
      trustServerCertificate: parseBoolean(process.env.SQL_TRUST_SERVER_CERT, false)
    },
    pool: {
      max: parseIntOrDefault(process.env.SQL_POOL_MAX, 10),
      min: parseIntOrDefault(process.env.SQL_POOL_MIN, 0),
      idleTimeoutMillis: parseIntOrDefault(process.env.SQL_POOL_IDLE, 30000)
    }
  },
  views: {
    siteTrend: sanitizeIdentifier(
      process.env.SQL_VIEW_SITE_TREND || 'vw_site_trend',
      'SQL_VIEW_SITE_TREND'
    ),
    aifr: sanitizeIdentifier(process.env.SQL_VIEW_AIFR || 'vw_aifr', 'SQL_VIEW_AIFR'),
    incidentDistribution: sanitizeIdentifier(
      process.env.SQL_VIEW_INCIDENT_DISTRIBUTION || 'vw_incident_distribution',
      'SQL_VIEW_INCIDENT_DISTRIBUTION'
    ),
    incidentCause: sanitizeIdentifier(
      process.env.SQL_VIEW_INCIDENT_CAUSE || 'vw_incident_cause',
      'SQL_VIEW_INCIDENT_CAUSE'
    ),
    hourlyFatigue: sanitizeIdentifier(
      process.env.SQL_VIEW_HOURLY_FATIGUE || 'vw_hourly_fatigue',
      'SQL_VIEW_HOURLY_FATIGUE'
    ),
    monitoringRisk: sanitizeIdentifier(
      process.env.SQL_VIEW_MONITORING_RISK || 'vw_monitoring_risk',
      'SQL_VIEW_MONITORING_RISK'
    ),
    riskyOperators: sanitizeIdentifier(
      process.env.SQL_VIEW_RISKY_OPERATORS || 'vw_risky_operators',
      'SQL_VIEW_RISKY_OPERATORS'
    ),
    incidentLocations: sanitizeIdentifier(
      process.env.SQL_VIEW_INCIDENT_LOCATIONS || 'vw_incident_locations',
      'SQL_VIEW_INCIDENT_LOCATIONS'
    ),
    sensorStatus: sanitizeIdentifier(
      process.env.SQL_VIEW_SENSOR_STATUS || 'vw_sensor_status',
      'SQL_VIEW_SENSOR_STATUS'
    ),
    hazardPerSite: sanitizeIdentifier(
      process.env.SQL_VIEW_HAZARD_PER_SITE || 'vw_hazard_per_site',
      'SQL_VIEW_HAZARD_PER_SITE'
    ),
    hazardMonthly: sanitizeIdentifier(
      process.env.SQL_VIEW_HAZARD_MONTHLY || 'vw_hazard_monthly',
      'SQL_VIEW_HAZARD_MONTHLY'
    ),
    hazardFollowUp: sanitizeIdentifier(
      process.env.SQL_VIEW_HAZARD_FOLLOW_UP || 'vw_hazard_follow_up',
      'SQL_VIEW_HAZARD_FOLLOW_UP'
    ),
    leadingGauges: sanitizeIdentifier(
      process.env.SQL_VIEW_LEADING_GAUGES || 'vw_leading_gauges',
      'SQL_VIEW_LEADING_GAUGES'
    ),
    calendarEvents: sanitizeIdentifier(
      process.env.SQL_VIEW_CALENDAR_EVENTS || 'vw_calendar_events',
      'SQL_VIEW_CALENDAR_EVENTS'
    ),
    safetyKpis: sanitizeIdentifier(
      process.env.SQL_VIEW_SAFETY_KPIS || 'vw_safety_kpis',
      'SQL_VIEW_SAFETY_KPIS'
    ),
    monitoringSummary: sanitizeIdentifier(
      process.env.SQL_VIEW_MONITORING_SUMMARY || 'vw_monitoring_summary',
      'SQL_VIEW_MONITORING_SUMMARY'
    ),
    strategicScore: sanitizeIdentifier(
      process.env.SQL_VIEW_STRATEGIC_SCORE || 'vw_strategic_score',
      'SQL_VIEW_STRATEGIC_SCORE'
    ),
    weatherStatus: sanitizeIdentifier(
      process.env.SQL_VIEW_WEATHER_STATUS || 'vw_weather_status',
      'SQL_VIEW_WEATHER_STATUS'
    ),
    announcements: sanitizeIdentifier(
      process.env.SQL_VIEW_ANNOUNCEMENTS || 'vw_announcements',
      'SQL_VIEW_ANNOUNCEMENTS'
    ),
    dashboardMeta: sanitizeIdentifier(
      process.env.SQL_VIEW_DASHBOARD_META || 'vw_dashboard_meta',
      'SQL_VIEW_DASHBOARD_META'
    ),
    calendarMeta: sanitizeIdentifier(
      process.env.SQL_VIEW_CALENDAR_META || 'vw_calendar_meta',
      'SQL_VIEW_CALENDAR_META'
    )
  }
};

const validateEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
};

module.exports = {
  config,
  validateEnv
};
