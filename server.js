const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { config, validateEnv } = require('./src/config');
const { closePool, query } = require('./src/db');
const dashboardRoutes = require('./src/routes/dashboard');

try {
  validateEnv();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

const corsOrigins = config.cors.origins;
const corsOptions = corsOrigins === '*' ? { origin: '*' } : { origin: corsOrigins };

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

app.use('/api', dashboardRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});

const shutdown = async () => {
  try {
    await closePool();
  } catch (error) {
    console.error('Error closing database pool', error);
  }

  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
