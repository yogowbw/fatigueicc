const express = require('express');
const { setSensorApiMode, getSensorApiMode } = require('../config/runtimeState');
const { sensorCache } = require('../cache/sensorCache');
const { eventCache } = require('../cache/eventCache');

const configRouter = express.Router();

configRouter.post('/mode', (req, res) => {
  const { mode } = req.body;
  if (!mode || !['real', 'mock'].includes(mode)) {
    return res.status(400).json({ error: `Invalid or missing mode: ${mode}` });
  }

  setSensorApiMode(mode);
  sensorCache.clear();
  eventCache.clear();
  res.json({ status: 'ok', newMode: mode });
});

configRouter.get('/mode', (req, res) => {
  const currentMode = getSensorApiMode();
  res.json({ mode: currentMode });
});

module.exports = { configRouter };
