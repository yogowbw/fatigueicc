const { config } = require('../config');
const { getDashboardData } = require('./dashboardService');

const clients = new Set();
let broadcastInterval = null;
let keepAliveInterval = null;
let lastPayload = null;
let broadcastPromise = null;

const sendEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const sendComment = (res, comment) => {
  res.write(`: ${comment}\n\n`);
};

const safeSendEvent = (res, event, data) => {
  if (res.writableEnded) {
    clients.delete(res);
    return;
  }

  try {
    sendEvent(res, event, data);
  } catch (error) {
    clients.delete(res);
  }
};

const broadcast = async () => {
  if (clients.size === 0) {
    return null;
  }

  if (broadcastPromise) {
    return broadcastPromise;
  }

  broadcastPromise = (async () => {
    try {
      const payload = await getDashboardData();
      lastPayload = payload;
      clients.forEach((res) => safeSendEvent(res, 'dashboard', payload));
    } catch (error) {
      const message = error && error.message ? error.message : 'Failed to fetch dashboard data';
      clients.forEach((res) => safeSendEvent(res, 'server-error', { message }));
    } finally {
      broadcastPromise = null;
    }

    return lastPayload;
  })();

  return broadcastPromise;
};

const ensureIntervals = () => {
  if (broadcastInterval) {
    return;
  }

  broadcast();
  broadcastInterval = setInterval(broadcast, config.sse.dashboardIntervalMs);
  keepAliveInterval = setInterval(() => {
    clients.forEach((res) => {
      if (res.writableEnded) {
        clients.delete(res);
        return;
      }
      sendComment(res, 'keep-alive');
    });

    if (clients.size === 0) {
      stopIntervals();
    }
  }, config.sse.keepAliveMs);
};

const stopIntervals = () => {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
};

const addClient = async (res) => {
  clients.add(res);

  res.write(`retry: ${config.sse.retryMs}\n\n`);

  if (lastPayload) {
    safeSendEvent(res, 'dashboard', lastPayload);
  } else {
    await broadcast();
  }

  ensureIntervals();
};

const removeClient = (res) => {
  clients.delete(res);
  if (clients.size === 0) {
    stopIntervals();
  }
};

module.exports = {
  addClient,
  removeClient
};
