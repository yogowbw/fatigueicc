const { config } = require('../config/env');
const { sql, getPool } = require('../db/sqlServer');

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

const persistSnapshot = async (cache) => {
  const readings = cache.getAll();
  if (!readings.length) return { inserted: 0 };

  const pool = await getPool();
  const table = buildBulkTable(readings);
  await pool.request().bulk(table);

  return { inserted: readings.length };
};

const startPersistenceJob = (cache) => {
  let isRunning = false;

  const runOnce = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await persistSnapshot(cache);
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
