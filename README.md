# Dashboard Backend API (Semi Realtime)

Backend ini menjadi **single data source** untuk frontend dashboard. Data realtime dipolling tiap 1 detik, disimpan ke **in-memory cache** sebagai last known value, lalu dipersist ke **SQL Server** secara periodik (default 60 detik). Frontend hanya fetch ke backend setiap 1 detik.

## Arsitektur Singkat

1. **Polling Realtime API** (1 detik)
2. **Cache in-memory** menyimpan last known value per sensor
3. **Persist ke SQL Server** (30-60 detik)
4. **Frontend fetch** hanya dari backend (bukan ke sensor API)
5. Jika realtime API gagal, backend tetap mengembalikan **last known value**

## Struktur Folder

```
src/
  app.js
  index.js
  config/
    env.js
  cache/
    sensorCache.js
  controllers/
    dashboardController.js
  routes/
    dashboardRoutes.js
  services/
    sensorApiClient.js
    realtimePollingService.js
    persistenceService.js
    dashboardService.js
  db/
    sqlServer.js
    queries.js
database/
  schema.sql
```

## Konfigurasi Lokal

### Prasyarat
- Node.js 18+
- SQL Server lokal

### Langkah
1. Buat database dan tabel:
   ```sql
   -- lihat database/schema.sql
   ```
2. Copy env:
   ```bash
   cp .env.example .env
   ```
3. Pastikan kredensial SQL lokal sesuai:
   ```
   SQL_DATABASE=icc
   SQL_USER=yogo
   SQL_PASSWORD="P@$$w0rd123!@#"
   SQL_SERVER=localhost
   TIME_ZONE=Asia/Jakarta
   ```
4. Jalankan:
   ```bash
   npm install
   npm run dev
   ```

API akan berjalan di `http://localhost:3000`.

## Tahap awal: cek data dari API -> SQL (sebelum mapping ke frontend)

Jika ingin tahap awalnya hanya memastikan data masuk ke SQL:

1. Pastikan `.env` sudah diisi dengan SQL lokal dan API sensor:
   ```
   SENSOR_API_MODE=real
   SENSOR_API_BASE_URL=http://localhost:YOUR_SENSOR_API_PORT
   ```
   (Jika belum ada API sensor, gunakan `SENSOR_API_MODE=mock` untuk simulasi.)

2. Jalankan backend:
   ```bash
   npm run dev
   ```

3. Tunggu 1-2 menit agar job persist menulis data ke SQL.

4. Cek data di SQL Server:
   ```sql
   SELECT TOP 20 *
   FROM sensor_readings
   ORDER BY recorded_at DESC;

   SELECT COUNT(*) AS total_rows
   FROM sensor_readings;
   ```

Jika data sudah masuk ke SQL, barulah lanjut ke mapping ke frontend.

## Endpoint

### Petunjuk penggunaan API (untuk pemula)

Konsep dasar:
- **Endpoint** adalah alamat URL yang diakses.
- **Request** adalah permintaan ke endpoint.
- **Response** adalah data JSON yang dikirim balik oleh backend.

Cara paling gampang mencoba:

1. Cek server hidup:
   ```bash
   curl http://localhost:3000/health
   ```

2. Ambil data dashboard:
   ```bash
   curl http://localhost:3000/api/dashboard/overview
   ```

3. Ambil detail 1 sensor:
   ```bash
   curl http://localhost:3000/api/dashboard/sensor/DT-402
   ```

### GET /api/dashboard/overview
Response sudah siap untuk frontend (tidak perlu transform tambahan).

Contoh response:
```json
{
  "meta": {
    "serverTime": "2026-01-31T10:00:00.000Z",
    "serverDate": "2026-01-31",
    "refreshMs": 1000,
    "polling": {
      "isRunning": true,
      "lastSuccessAt": "2026-01-31T09:59:59.123Z",
      "lastErrorAt": null,
      "lastErrorMessage": null,
      "lastDurationMs": 120
    }
  },
  "deviceHealth": { "total": 10, "online": 9, "offline": 1, "coverage": 90 },
  "sensors": [
    {
      "sensorId": "DT-402",
      "status": "online",
      "value": 72.1,
      "timestamp": "2026-01-31T09:59:59.123Z",
      "receivedAt": "2026-01-31T09:59:59.123Z",
      "source": "realtime",
      "meta": {
        "unit": "DT-402",
        "operator": "Budi S.",
        "type": "Fatigue",
        "area": "Mining",
        "location": "Manado - Front A",
        "speed": "25 km/h",
        "count": 1
      }
    }
  ],
  "alerts": [
    {
      "id": "DT-402",
      "unit": "DT-402",
      "operator": "Budi S.",
      "type": "Fatigue",
      "area": "Mining",
      "location": "Manado - Front A",
      "time": "09:59:59",
      "date": "2026-01-31",
      "status": "Open",
      "speed": "25 km/h",
      "count": 1,
      "timestamp": "2026-01-31T09:59:59.123Z",
      "sensorId": "DT-402"
    }
  ],
  "stats": { "totalToday": 10, "followedUpToday": 3, "activeOpen": 7 },
  "areaSummary": {
    "Mining": { "open": 4, "resolved": 2, "total": 6 },
    "Hauling": { "open": 3, "resolved": 1, "total": 4 }
  },
  "locationStats": {
    "Mining": { "Manado - Front A": 2, "Pit Utara": 1 },
    "Hauling": { "KM 10": 1, "KM 22": 2 }
  },
  "highRiskOperators": [
    { "name": "Budi S.", "unit": "DT-402", "events": 3, "status": "Active" }
  ],
  "highRiskZones": [
    { "location": "KM 22", "count": 2, "area": "Hauling" }
  ],
  "overdueAlerts": [
    {
      "id": "DT-555",
      "unit": "DT-555",
      "operator": "Rian J.",
      "type": "Fatigue",
      "area": "Mining",
      "location": "Pit Utara",
      "time": "09:10:00",
      "date": "2026-01-31",
      "status": "Open",
      "speed": "0 km/h",
      "count": 2,
      "timestamp": "2026-01-31T09:10:00.000Z",
      "sensorId": "DT-555"
    }
  ]
}
```

### GET /api/dashboard/sensor/{sensorId}
```json
{
  "meta": {
    "serverTime": "2026-01-31T10:00:00.000Z",
    "serverDate": "2026-01-31",
    "lookbackMinutes": 60,
    "source": "cache"
  },
  "sensor": {
    "sensorId": "DT-402",
    "status": "online",
    "value": 72.1,
    "timestamp": "2026-01-31T09:59:59.123Z",
    "receivedAt": "2026-01-31T09:59:59.123Z",
    "source": "realtime",
    "meta": { "unit": "DT-402", "operator": "Budi S." }
  },
  "alert": {
    "id": "DT-402",
    "unit": "DT-402",
    "operator": "Budi S.",
    "type": "Fatigue",
    "area": "Mining",
    "location": "Manado - Front A",
    "time": "09:59:59",
    "date": "2026-01-31",
    "status": "Open",
    "speed": "25 km/h",
    "count": 1,
    "timestamp": "2026-01-31T09:59:59.123Z",
    "sensorId": "DT-402"
  },
  "history": [
    {
      "sensorId": "DT-402",
      "status": "online",
      "value": 71.9,
      "recordedAt": "2026-01-31T09:59:00.000Z",
      "receivedAt": "2026-01-31T09:59:00.100Z",
      "source": "realtime",
      "meta": { "unit": "DT-402", "operator": "Budi S." }
    }
  ]
}
```

## SQL Schema dan Query

Schema: lihat `database/schema.sql`.

Contoh query:
```sql
-- Ambil history 60 menit terakhir
SELECT TOP (@limit)
  sensor_id, status, value, recorded_at, received_at, source, meta
FROM sensor_readings
WHERE sensor_id = @sensorId
  AND recorded_at >= DATEADD(minute, -@lookbackMinutes, SYSUTCDATETIME())
ORDER BY recorded_at DESC;

-- Ambil data terakhir
SELECT TOP 1
  sensor_id, status, value, recorded_at, received_at, source, meta
FROM sensor_readings
WHERE sensor_id = @sensorId
ORDER BY recorded_at DESC;
```

## Konfigurasi Environment (Localhost)

Lihat `.env.example`.

Catatan:
- `SENSOR_API_MODE=mock` akan menghasilkan data dummy agar backend bisa langsung dicoba.
- Jika realtime API asli sudah siap, set `SENSOR_API_MODE=real` dan isi `SENSOR_API_BASE_URL`.
- Mapping data realtime ke struktur frontend bisa diubah di `src/services/dashboardService.js`.
- `TIME_ZONE` menentukan tanggal/waktu yang dipakai backend (default `Asia/Jakarta`).

## Catatan Deploy ke Azure App Service + SQL MI

1. **Environment Variables**  
   Set semua env di App Service (PORT, SQL_CONNECTION_STRING, SENSOR_API_*, dll).

2. **SQL MI Connection**  
   - Gunakan connection string SQL MI.
   - Pastikan `SQL_ENCRYPT=true` dan `SQL_TRUST_CERT=false` untuk production.
   - Pastikan App Service dan SQL MI berada di VNet yang sama atau sudah dipeering.

3. **Always On**  
   Aktifkan **Always On** di App Service agar polling tidak berhenti.

4. **Scaling**  
   Backend sudah stateless (cache in-memory per instance). Untuk scale out:
   - Pertimbangkan shared cache (Redis) jika butuh konsistensi lintas instance.
   - Polling bisa dipindah ke background job/worker jika dibutuhkan.

---

Jika butuh penyesuaian lebih lanjut sesuai API sensor asli, tinggal ubah mapping di:
- `src/services/sensorApiClient.js` (format data realtime)
- `src/services/dashboardService.js` (format data untuk frontend)
