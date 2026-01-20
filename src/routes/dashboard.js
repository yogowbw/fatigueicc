const express = require('express');

const {
  getDashboardData,
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
  getCalendarEvents
} = require('../services/dashboardService');
const {
  normalizeZone,
  normalizeSite,
  normalizeIsoDate
} = require('../utils/validation');

const router = express.Router();

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const data = await getDashboardData();
    res.json(data);
  })
);

router.get(
  '/site-trends',
  asyncHandler(async (req, res) => {
    const zone = normalizeZone(req.query.zone);
    const data = await getSiteTrend({ zone });
    res.json(data);
  })
);

router.get(
  '/aifr',
  asyncHandler(async (req, res) => {
    res.json(await getAifr());
  })
);

router.get(
  '/incident-distribution',
  asyncHandler(async (req, res) => {
    const zone = normalizeZone(req.query.zone);
    res.json(await getIncidentDistribution({ zone }));
  })
);

router.get(
  '/incident-causes',
  asyncHandler(async (req, res) => {
    const zone = normalizeZone(req.query.zone);
    res.json(await getIncidentCause({ zone }));
  })
);

router.get(
  '/hourly-fatigue',
  asyncHandler(async (req, res) => {
    const date = normalizeIsoDate(req.query.date);
    if (req.query.date && !date) {
      return res
        .status(400)
        .json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    res.json(await getHourlyFatigue({ date }));
  })
);

router.get(
  '/monitoring-risks',
  asyncHandler(async (req, res) => {
    res.json(await getMonitoringRisk());
  })
);

router.get(
  '/risky-operators',
  asyncHandler(async (req, res) => {
    res.json(await getRiskyOperators());
  })
);

router.get(
  '/incident-locations',
  asyncHandler(async (req, res) => {
    res.json(await getIncidentLocations());
  })
);

router.get(
  '/sensor-status',
  asyncHandler(async (req, res) => {
    res.json(await getSensorStatus());
  })
);

router.get(
  '/hazard/per-site',
  asyncHandler(async (req, res) => {
    res.json(await getHazardPerSite());
  })
);

router.get(
  '/hazard/monthly',
  asyncHandler(async (req, res) => {
    const site = normalizeSite(req.query.site);
    res.json(await getHazardMonthly({ site }));
  })
);

router.get(
  '/hazard/follow-up',
  asyncHandler(async (req, res) => {
    res.json(await getHazardFollowUp());
  })
);

router.get(
  '/leading-gauges',
  asyncHandler(async (req, res) => {
    res.json(await getLeadingGauges());
  })
);

router.get(
  '/safety-kpis',
  asyncHandler(async (req, res) => {
    res.json(await getSafetyKpis());
  })
);

router.get(
  '/monitoring-summary',
  asyncHandler(async (req, res) => {
    res.json(await getMonitoringSummary());
  })
);

router.get(
  '/strategic-score',
  asyncHandler(async (req, res) => {
    res.json(await getStrategicScore());
  })
);

router.get(
  '/weather',
  asyncHandler(async (req, res) => {
    res.json(await getWeatherStatus());
  })
);

router.get(
  '/announcements',
  asyncHandler(async (req, res) => {
    res.json(await getAnnouncements());
  })
);

router.get(
  '/dashboard-meta',
  asyncHandler(async (req, res) => {
    res.json(await getDashboardMeta());
  })
);

router.get(
  '/calendar-meta',
  asyncHandler(async (req, res) => {
    res.json(await getCalendarMeta());
  })
);

router.get(
  '/calendar-events',
  asyncHandler(async (req, res) => {
    res.json(await getCalendarEvents());
  })
);

module.exports = router;
