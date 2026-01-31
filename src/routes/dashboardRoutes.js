const express = require('express');
const { getOverview, getSensor } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/overview', getOverview);
router.get('/sensor/:sensorId', getSensor);

module.exports = { dashboardRouter: router };
