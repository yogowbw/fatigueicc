const getEventKey = (reading) => {
  if (!reading) return null;
  const meta = reading.meta || {};
  return (
    meta.id ||
    meta.identity ||
    `${reading.sensorId || 'unknown'}|${reading.timestamp || reading.receivedAt || ''}`
  );
};

class EventCache {
  constructor() {
    this.events = [];
    this.lastUpdatedAt = null;
  }

  replace(readings) {
    const unique = new Map();
    (readings || []).forEach((reading) => {
      const key = getEventKey(reading);
      if (!key || unique.has(key)) return;
      unique.set(key, reading);
    });

    const sorted = Array.from(unique.values()).sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });

    this.events = sorted;
    this.lastUpdatedAt = new Date().toISOString();
  }

  getAll() {
    return this.events;
  }

  getSnapshot() {
    return {
      lastUpdatedAt: this.lastUpdatedAt,
      count: this.events.length,
      events: this.events
    };
  }
}

const eventCache = new EventCache();

module.exports = { EventCache, eventCache, getEventKey };
