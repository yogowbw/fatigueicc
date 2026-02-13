const sql = require('mssql');
const { config } = require('../config/env');

let pool = null;
let poolPromise = null;

const buildSqlConfig = () => {
  const poolSettings = {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  };

  if (config.sql.connectionString) {
    return {
      connectionString: config.sql.connectionString,
      options: config.sql.options,
      pool: poolSettings
    };
  }

  return {
    user: config.sql.user,
    password: config.sql.password,
    server: config.sql.server,
    port: config.sql.port,
    database: config.sql.database,
    options: config.sql.options,
    pool: poolSettings
  };
};

const getPool = async () => {
  if (pool) return pool;
  if (!poolPromise) {
    poolPromise = sql.connect(buildSqlConfig());
  }

  pool = await poolPromise;
  return pool;
};

module.exports = { sql, getPool };
