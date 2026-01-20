const { config } = require('../config');
const { query } = require('../db');

const CAUSE_COLORS = {
  'Pelanggaran Prosedur': '#ef4444',
  Fatigue: '#f97316',
  'Standar Kerja Kurang Memadai': '#3b82f6',
  'Standar Kerja Kurang': '#3b82f6',
  'Pengawasan Area Kerja Kurang Memadai': '#a855f7',
  'Pengawasan Kurang': '#a855f7',
  'Lingkungan Kerja Tidak Aman (Binatang Liar)': '#22c55e',
  Lingkungan: '#22c55e',
  Lainnya: '#64748b'
};

const SENSOR_STATUS_THEME = {
  online: { color: 'text-green-500', bg: 'bg-green-500' },
  offline: { color: 'text-red-500', bg: 'bg-red-500' },
  maint: { color: 'text-yellow-500', bg: 'bg-yellow-500' },
  maintenance: { color: 'text-yellow-500', bg: 'bg-yellow-500' }
};

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

const groupBy = (rows, key, mapFn) =>
  rows.reduce((acc, row) => {
    const groupKey = row[key];
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(mapFn(row));
    return acc;
  }, {});

const getSiteTrend = async ({ zone } = {}) => {
  const view = config.views.siteTrend;

  if (zone) {
    const rows = await query(
      `SELECT name, nm, incident, total, sort_order FROM ${view} WHERE zone = @zone ORDER BY sort_order`,
      { zone }
    );
    return rows.map((row) => ({
      name: row.name,
      NM: toNumber(row.nm),
      Incident: toNumber(row.incident),
      Total: toNumber(row.total)
    }));
  }

  const rows = await query(
    `SELECT zone, name, nm, incident, total, sort_order FROM ${view} ORDER BY zone, sort_order`
  );

  return groupBy(rows, 'zone', (row) => ({
    name: row.name,
    NM: toNumber(row.nm),
    Incident: toNumber(row.incident),
    Total: toNumber(row.total)
  }));
};

const getAifr = async () => {
  const rows = await query(`SELECT name, value FROM ${config.views.aifr} ORDER BY name`);
  return rows.map((row) => ({
    name: row.name,
    value: String(row.value)
  }));
};

const getIncidentDistribution = async ({ zone } = {}) => {
  const view = config.views.incidentDistribution;

  if (zone) {
    const rows = await query(
      `SELECT name, value, sort_order FROM ${view} WHERE zone = @zone ORDER BY sort_order`,
      { zone }
    );
    return rows.map((row) => ({
      name: row.name,
      value: toNumber(row.value)
    }));
  }

  const rows = await query(
    `SELECT zone, name, value, sort_order FROM ${view} ORDER BY zone, sort_order`
  );
  return groupBy(rows, 'zone', (row) => ({
    name: row.name,
    value: toNumber(row.value)
  }));
};

const getIncidentCause = async ({ zone } = {}) => {
  const view = config.views.incidentCause;

  if (zone) {
    const rows = await query(
      `SELECT name, value, color, sort_order FROM ${view} WHERE zone = @zone ORDER BY sort_order`,
      { zone }
    );
    return rows.map((row) => ({
      name: row.name,
      value: toNumber(row.value),
      color: row.color || CAUSE_COLORS[row.name] || '#64748b'
    }));
  }

  const rows = await query(
    `SELECT zone, name, value, color, sort_order FROM ${view} ORDER BY zone, sort_order`
  );
  return groupBy(rows, 'zone', (row) => ({
    name: row.name,
    value: toNumber(row.value),
    color: row.color || CAUSE_COLORS[row.name] || '#64748b'
  }));
};

const getHourlyFatigue = async ({ date } = {}) => {
  const view = config.views.hourlyFatigue;
  const queryText = date
    ? `SELECT hour, today, avg FROM ${view} WHERE date = @date ORDER BY hour`
    : `SELECT hour, today, avg FROM ${view} ORDER BY hour`;
  const rows = await query(queryText, date ? { date } : {});

  return rows.map((row) => ({
    hour: row.hour,
    today: toNumber(row.today),
    avg: toNumber(row.avg)
  }));
};

const getMonitoringRisk = async () => {
  const rows = await query(
    `SELECT id, unit, driver, type, time, location, history, risk, status, weather FROM ${config.views.monitoringRisk}`
  );
  return rows.map((row) => ({
    id: row.id,
    unit: row.unit,
    driver: row.driver,
    type: row.type,
    time: row.time,
    location: row.location,
    history: row.history,
    risk: row.risk,
    status: row.status,
    weather: row.weather
  }));
};

const getRiskyOperators = async () => {
  const rows = await query(
    `SELECT rank, name, unit, alerts, score FROM ${config.views.riskyOperators} ORDER BY rank`
  );
  return rows.map((row) => ({
    rank: row.rank,
    name: row.name,
    unit: row.unit,
    alerts: toNumber(row.alerts),
    score: toNumber(row.score)
  }));
};

const getIncidentLocations = async () => {
  const rows = await query(
    `SELECT name, count, level FROM ${config.views.incidentLocations} ORDER BY count DESC`
  );
  return rows.map((row) => ({
    name: row.name,
    count: toNumber(row.count),
    level: row.level
  }));
};

const getSensorStatus = async () => {
  const rows = await query(
    `SELECT status, value FROM ${config.views.sensorStatus} ORDER BY status`
  );

  const breakdown = rows.map((row) => {
    const key = String(row.status || '').trim().toLowerCase();
    const theme = SENSOR_STATUS_THEME[key] || {
      color: 'text-slate-500',
      bg: 'bg-slate-500'
    };
    return {
      label: row.status,
      value: toNumber(row.value),
      color: theme.color,
      bg: theme.bg
    };
  });

  const total = breakdown.reduce((sum, item) => sum + item.value, 0);

  return {
    total,
    breakdown
  };
};

const getHazardPerSite = async () => {
  const rows = await query(
    `SELECT name, plan, actual, ach FROM ${config.views.hazardPerSite} ORDER BY name`
  );
  return rows.map((row) => ({
    name: row.name,
    plan: toNumber(row.plan),
    actual: toNumber(row.actual),
    ach: toNumber(row.ach)
  }));
};

const getHazardMonthly = async ({ site } = {}) => {
  const view = config.views.hazardMonthly;

  if (site) {
    const rows = await query(
      `SELECT name, plan, actual, ach, sort_order FROM ${view} WHERE site = @site ORDER BY sort_order`,
      { site }
    );
    return rows.map((row) => ({
      name: row.name,
      plan: toNumber(row.plan),
      actual: toNumber(row.actual),
      ach: toNumber(row.ach)
    }));
  }

  const rows = await query(
    `SELECT site, name, plan, actual, ach, sort_order FROM ${view} ORDER BY site, sort_order`
  );
  return groupBy(rows, 'site', (row) => ({
    name: row.name,
    plan: toNumber(row.plan),
    actual: toNumber(row.actual),
    ach: toNumber(row.ach)
  }));
};

const getHazardFollowUp = async () => {
  const rows = await query(
    `SELECT name, plan, actual, ach FROM ${config.views.hazardFollowUp} ORDER BY name`
  );
  return rows.map((row) => ({
    name: row.name,
    plan: toNumber(row.plan),
    actual: toNumber(row.actual),
    ach: toNumber(row.ach)
  }));
};

const getLeadingGauges = async () => {
  const rows = await query(
    `SELECT title, value FROM ${config.views.leadingGauges} ORDER BY title`
  );
  return rows.map((row) => ({
    title: row.title,
    value: toNumber(row.value)
  }));
};

const getSafetyKpis = async () => {
  const rows = await query(`SELECT key, value FROM ${config.views.safetyKpis}`);

  return rows.reduce((acc, row) => {
    const key = String(row.key || row.name || '')
      .trim()
      .toUpperCase();
    if (key) {
      acc[key] = toNumber(row.value);
    }
    return acc;
  }, {});
};

const getMonitoringSummary = async () => {
  const rows = await query(
    `SELECT key, value, unit, trend, subtext FROM ${config.views.monitoringSummary}`
  );

  return rows.map((row) => ({
    key: row.key,
    value: toNumber(row.value),
    unit: row.unit,
    trend: row.trend,
    subtext: row.subtext
  }));
};

const getStrategicScore = async () => {
  const rows = await query(
    `SELECT TOP 1 score, label, subtext, color FROM ${config.views.strategicScore}`
  );
  const row = rows[0] || {};

  return {
    score: toNumber(row.score),
    label: row.label || '',
    subtext: row.subtext || '',
    color: row.color || 'yellow'
  };
};

const getWeatherStatus = async () => {
  const rows = await query(
    `SELECT TOP 1 temperature, condition, wind_speed, humidity, alert_text, alert_level FROM ${config.views.weatherStatus}`
  );
  const row = rows[0] || {};

  return {
    temperature: toNumber(row.temperature),
    condition: row.condition || '',
    windSpeed: toNumber(row.wind_speed),
    humidity: toNumber(row.humidity),
    alertText: row.alert_text || '',
    alertLevel: row.alert_level || 'high'
  };
};

const getAnnouncements = async () => {
  const rows = await query(
    `SELECT message, sort_order FROM ${config.views.announcements} ORDER BY sort_order`
  );
  return rows.map((row) => ({
    message: row.message
  }));
};

const getDashboardMeta = async () => {
  const rows = await query(
    `SELECT TOP 1 last_update FROM ${config.views.dashboardMeta}`
  );
  const row = rows[0] || {};
  const lastUpdate = row.last_update ? new Date(row.last_update).toISOString() : null;

  return {
    lastUpdate
  };
};

const getCalendarMeta = async () => {
  const rows = await query(
    `SELECT TOP 1 year, month, month_name, start_day, days_in_month FROM ${config.views.calendarMeta}`
  );
  const row = rows[0] || {};

  return {
    year: row.year ? toNumber(row.year) : null,
    month: row.month ? toNumber(row.month) : null,
    monthName: row.month_name || null,
    startDay:
      row.start_day === null || row.start_day === undefined
        ? null
        : toNumber(row.start_day),
    daysInMonth:
      row.days_in_month === null || row.days_in_month === undefined
        ? null
        : toNumber(row.days_in_month)
  };
};

const getCalendarEvents = async () => {
  const rows = await query(
    `SELECT day, type, site, color FROM ${config.views.calendarEvents} ORDER BY day`
  );

  const grouped = rows.reduce((acc, row) => {
    const key = toNumber(row.day);
    if (!acc[key]) {
      acc[key] = { day: key, events: [] };
    }

    acc[key].events.push({
      type: row.type,
      site: row.site,
      color: row.color
    });
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => a.day - b.day);
};

const getDashboardData = async () => {
  const [
    siteTrendData,
    aifrData,
    incidentDistributionData,
    incidentCauseData,
    hourlyFatigueComparison,
    monitoringRiskData,
    riskyOperators,
    incidentLocationsData,
    sensorStatusData,
    hazardPerSiteData,
    hazardMonthlyData,
    hazardFollowUpData,
    leadingGaugeData,
    calendarEvents,
    safetyKpis,
    monitoringSummary,
    strategicScore,
    weather,
    announcements,
    dashboardMeta,
    calendarMeta
  ] = await Promise.all([
    getSiteTrend(),
    getAifr(),
    getIncidentDistribution(),
    getIncidentCause(),
    getHourlyFatigue(),
    getMonitoringRisk(),
    getRiskyOperators(),
    getIncidentLocations(),
    getSensorStatus(),
    getHazardPerSite(),
    getHazardMonthly(),
    getHazardFollowUp(),
    getLeadingGauges(),
    getCalendarEvents(),
    getSafetyKpis(),
    getMonitoringSummary(),
    getStrategicScore(),
    getWeatherStatus(),
    getAnnouncements(),
    getDashboardMeta(),
    getCalendarMeta()
  ]);

  return {
    siteTrendData,
    aifrData,
    incidentDistributionData,
    incidentCauseData,
    hourlyFatigueComparison,
    monitoringRiskData,
    riskyOperators,
    incidentLocationsData,
    sensorStatusData,
    hazardPerSiteData,
    hazardMonthlyData,
    hazardMonthlyADMO: hazardMonthlyData.ADMO || [],
    hazardMonthlyMACO: hazardMonthlyData.MACO || [],
    hazardMonthlySERA: hazardMonthlyData.SERA || [],
    hazardFollowUpData,
    leadingGaugeData,
    calendarEvents,
    safetyKpis,
    monitoringSummary,
    strategicScore,
    weather,
    announcements,
    dashboardMeta,
    calendarMeta
  };
};

module.exports = {
  getSiteTrend,
  getAifr,
  getIncidentDistribution,
  getIncidentCause,
  getHourlyFatigue,
  getMonitoringRisk,
  getRiskyOperators,
  getIncidentLocations,
  getSensorStatus,
  getHazardPerSite,
  getHazardMonthly,
  getHazardFollowUp,
  getLeadingGauges,
  getSafetyKpis,
  getMonitoringSummary,
  getStrategicScore,
  getWeatherStatus,
  getAnnouncements,
  getDashboardMeta,
  getCalendarMeta,
  getCalendarEvents,
  getDashboardData
};
