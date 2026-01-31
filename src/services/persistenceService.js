const { config } = require('../config/env');
const { sql, getPool } = require('../db/sqlServer');
const { getEventKey } = require('../cache/eventCache');

const buildBulkTable = (readings) => {
  const table = new sql.Table('sensor_readings');
  table.create = false;

  table.columns.add('sensor_id', sql.VarChar(50), { nullable: false });
  table.columns.add('status', sql.VarChar(20), { nullable: false });
  table.columns.add('value', sql.Float, { nullable: true });
  table.columns.add('recorded_at', sql.DateTime2(3), { nullable: false });
  table.columns.add('received_at', sql.DateTime2(3), { nullable: false });
  table.columns.add('source', sql.VarChar(20), { nullable: false });
  table.columns.add('meta', sql.NVarChar(sql.MAX), { nullable: true });

  readings.forEach((reading) => {
    table.rows.add(
      reading.sensorId,
      reading.status || 'unknown',
      Number.isFinite(Number(reading.value)) ? Number(reading.value) : null,
      new Date(reading.timestamp),
      new Date(reading.receivedAt || reading.timestamp),
      reading.source || 'cache',
      reading.meta ? JSON.stringify(reading.meta) : null
    );
  });

  return table;
};

const persistState = {
  persistedIds: new Set(),
  persistedQueue: []
};

const trackPersistedId = (id) => {
  if (!id || persistState.persistedIds.has(id)) return;
  persistState.persistedIds.add(id);
  persistState.persistedQueue.push(id);
  if (persistState.persistedQueue.length > 10000) {
    const oldest = persistState.persistedQueue.shift();
    persistState.persistedIds.delete(oldest);
  }
};

const getReadingsForPersist = (cache, eventsCache) => {
  if (config.sensorApiMode === 'integrator' && eventsCache) {
    const readings = eventsCache.getAll();
    return readings.filter((reading) => {
      const key = getEventKey(reading);
      return key && !persistState.persistedIds.has(key);
    });
  }

  return cache.getAll();
};

const persistSnapshot = async (cache, eventsCache) => {
  const readings = getReadingsForPersist(cache, eventsCache);
  if (!readings.length) return { inserted: 0 };

  const pool = await getPool();
  const table = buildBulkTable(readings);
  await pool.request().bulk(table);

  if (config.sensorApiMode === 'integrator') {
    readings.forEach((reading) => trackPersistedId(getEventKey(reading)));
  }

  return { inserted: readings.length };
};

const startPersistenceJob = (cache, eventsCache) => {
  let isRunning = false;

  const runOnce = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await persistSnapshot(cache, eventsCache);
    } catch (error) {
      console.error('Failed to persist snapshot:', error.message || error);
    } finally {
      isRunning = false;
    }
  };

  runOnce();
  const timer = setInterval(runOnce, config.persistIntervalMs);

  return () => clearInterval(timer);
};

module.exports = { startPersistenceJob };
