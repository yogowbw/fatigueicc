class SensorCache {
  constructor() {
    this.store = new Map();
    this.lastUpdatedAt = null;
  }

  upsert(reading) {
    if (!reading || !reading.sensorId) return;

    const existing = this.store.get(reading.sensorId) || {};
    const incomingTimestamp = reading.timestamp
      ? new Date(reading.timestamp).getTime()
      : null;
    const existingTimestamp = existing.timestamp
      ? new Date(existing.timestamp).getTime()
      : null;

    if (
      Number.isFinite(incomingTimestamp) &&
      Number.isFinite(existingTimestamp) &&
      incomingTimestamp < existingTimestamp
    ) {
      return;
    }

    const updatedAt = new Date().toISOString();

    const entry = {
      sensorId: reading.sensorId,
      status: reading.status ?? existing.status ?? 'unknown',
      value: reading.value ?? existing.value ?? null,
      timestamp: reading.timestamp ?? existing.timestamp ?? updatedAt,
      receivedAt: reading.receivedAt ?? existing.receivedAt ?? updatedAt,
      source: reading.source ?? existing.source ?? 'cache',
      meta: reading.meta ?? existing.meta ?? {},
      updatedAt
    };

    this.store.set(reading.sensorId, entry);
    this.lastUpdatedAt = updatedAt;
  }

  get(sensorId) {
    return this.store.get(sensorId) || null;
  }

  getAll() {
    return Array.from(this.store.values());
  }

  getSnapshot() {
    return {
      lastUpdatedAt: this.lastUpdatedAt,
      count: this.store.size,
      sensors: this.getAll()
    };
  }
}

const sensorCache = new SensorCache();

module.exports = { SensorCache, sensorCache };
