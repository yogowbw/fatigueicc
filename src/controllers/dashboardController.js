const { sensorCache } = require('../cache/sensorCache');
const { eventCache } = require('../cache/eventCache');
const { createDashboardService } = require('../services/dashboardService');
const { getPollingStatus } = require('../services/realtimePollingService');

const dashboardService = createDashboardService({
  cache: sensorCache,
  eventCache,
  pollingStatus: getPollingStatus
});

const getOverview = async (req, res) => {
  try {
    const data = await dashboardService.getOverview();
    res.json(data);
  } catch (error) {
    console.error('Failed to load overview:', error.message || error);
    res.status(500).json({ error: 'Failed to load dashboard overview' });
  }
};

const getSensor = async (req, res) => {
  try {
    const sensorId = req.params.sensorId;
    const data = await dashboardService.getSensorDetail(sensorId);

    if (!data.sensor && (!data.history || data.history.length === 0)) {
      return res.status(404).json({ error: 'Sensor not found' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Failed to load sensor detail:', error.message || error);
    return res.status(500).json({ error: 'Failed to load sensor detail' });
  }
};

module.exports = { getOverview, getSensor };
