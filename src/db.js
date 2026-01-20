const sql = require('mssql');

const { config } = require('./config');

let pool;

const addParams = (request, params = {}) => {
  Object.entries(params).forEach(([key, value]) => {
    if (value && typeof value === 'object' && 'value' in value) {
      request.input(key, value.type, value.value);
    } else {
      request.input(key, value);
    }
  });
};

const getPool = async () => {
  if (!pool) {
    pool = await sql.connect({
      server: config.sql.server,
      database: config.sql.database,
      user: config.sql.user,
      password: config.sql.password,
      port: config.sql.port,
      options: config.sql.options,
      pool: config.sql.pool
    });
  }

  return pool;
};

const query = async (text, params = {}) => {
  const activePool = await getPool();
  const request = activePool.request();
  addParams(request, params);

  const result = await request.query(text);
  return result.recordset || [];
};

const execute = async (procName, params = {}) => {
  const activePool = await getPool();
  const request = activePool.request();
  addParams(request, params);

  const result = await request.execute(procName);
  return result.recordset || [];
};

const closePool = async () => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};

module.exports = {
  sql,
  getPool,
  query,
  execute,
  closePool
};
