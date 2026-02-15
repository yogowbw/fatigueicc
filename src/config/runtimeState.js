const { config } = require('./env');

const normalizeMode = (mode) => (mode === 'mock' ? 'mock' : 'real');

// Inisialisasi state dari konfigurasi statis yang dibaca dari .env.
const state = {
  sensorApiMode: normalizeMode(config.sensorApiMode)
};

/**
 * Mengambil mode API sensor yang sedang aktif.
 * @returns {'real' | 'mock'}
 */
const getSensorApiMode = () => state.sensorApiMode;

/**
 * Mengubah mode API sensor saat runtime.
 * @param {'real' | 'mock'} newMode
 */
const setSensorApiMode = (newMode) => {
  const mode = normalizeMode(newMode);
  state.sensorApiMode = mode;
  console.log(`[App] Sensor API mode switched to: ${mode}`);
};

module.exports = { getSensorApiMode, setSensorApiMode };
