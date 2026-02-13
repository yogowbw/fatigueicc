const { getPool, sql } = require('../src/db/sqlServer');

async function testConnection() {
  console.log('Mencoba menghubungkan ke SQL Server...');
  let pool;
  let errorOccurred = false;
  try {
    // Memanggil getPool() akan memicu upaya koneksi
    pool = await getPool();
    console.log('✅ Koneksi ke SQL Server berhasil!');

    // (Opsional) Lakukan query sederhana untuk verifikasi lebih lanjut
    const result = await pool.request().query('SELECT GETDATE() as now');
    console.log('   - Hasil query verifikasi (waktu server):', result.recordset[0].now);
    console.log('   - Terhubung ke Server:', pool.config.server);
    console.log('   - Terhubung ke Database:', pool.config.database);
  } catch (error) {
    errorOccurred = true;
    console.error('❌ Gagal terhubung ke SQL Server.');
    console.error('   Detail Error:', error.message);
    if (error.originalError && error.originalError.info) {
      console.error('   Info Tambahan:', error.originalError.info.message);
    }
  } finally {
    if (pool) {
      await sql.close();
      console.log('Koneksi ditutup.');
    }
    process.exit(errorOccurred ? 1 : 0);
  }
}

testConnection();