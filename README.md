# Dashboard Backend API (Semi Realtime)

Backend ini menjadi **single data source** untuk frontend dashboard. Data realtime dipolling tiap 1 detik, disimpan ke **in-memory cache** sebagai last known value, lalu dipersist ke **SQL Server** secara periodik (default 60 detik). Frontend hanya fetch ke backend setiap 1 detik.

## Frontend (React + Vite)

Frontend tersedia di folder `frontend/`.

### Menjalankan Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend akan berjalan di `http://localhost:5173` dan otomatis proxy ke backend (`/api` -> `http://localhost:3000`).

Jika ingin override API URL, set env:
```
VITE_API_BASE_URL=http://localhost:3000
```

Untuk mengubah zona waktu tampilan frontend:
```
VITE_TIME_ZONE=Asia/Makassar
VITE_TIME_LABEL=WITA
```

Untuk memperbesar tampilan di layar besar:
```
VITE_UI_SCALE=1.15
```

## Arsitektur Singkat

1. **Polling Realtime API** (1 detik)
2. **Cache in-memory** menyimpan last known value per sensor
3. **Persist ke SQL Server** (30-60 detik)
4. **Frontend fetch** hanya dari backend (bukan ke sensor API)
5. Jika realtime API gagal, backend tetap mengembalikan **last known value**

## Alur Data ke User (UI Dashboard)

1. Frontend memanggil `GET /api/dashboard/overview` tiap 1 detik.
2. Backend mengirim `alerts` yang sudah membawa `timestamp`, `date`, dan `time`.
3. Backend memfilter event berdasarkan **shift aktif saat ini** (WITA) per area:
   - Mining: Shift 1 `06:00-17:59`, Shift 2 `18:00-05:59`
   - Hauling: Shift 1 `05:00-16:59`, Shift 2 `17:00-04:59`
   Hanya event yang shift-nya sama dengan shift aktif area yang dikirim ke kartu utama.
4. Komponen **Active Fatigue Recent** menampilkan hanya alert dengan `status=Open` dan durasi open `< 30 menit` (berdasarkan kolom `time`, timezone-safe ke `Asia/Makassar`).
5. Komponen **Delayed Follow Up** menampilkan alert `status=Open` dengan durasi `>= 30 menit` (acuan `time`), dan label `LATE` dihitung dari selisih `current WITA` terhadap `manual_verification_time` yang distandarkan ke WITA (offset +8 jam).
6. Tombol sort **Newest/Oldest** hanya mengubah urutan list, tidak mengubah aturan filter durasi.
7. Komponen **Recurrent Fatigue Units** menampilkan unit yang punya pola berulang (transisi `Followed Up -> Open`).
8. Saat user klik item di **Recurrent Fatigue Units**, frontend membuka panel detail recurrent unit (`selectedRecurrentUnit`) dan menampilkan ringkasan:
   total event, status terakhir, oldest/newest alert, dominant fatigue, recurrence count, dan verifier sebelumnya.
9. Saat user klik item di **Active Fatigue Recent**, frontend membuka panel detail alert (`FATIGUE ALERT DETAIL`) untuk unit/event yang dipilih.
10. Header dashboard menampilkan jam dan tanggal WITA, serta label shift ringkas:
   `M : Shift X • H : Shift X`.
11. Saat terjadi pergantian shift aktif (Mining/Hauling), backend melakukan **cut off** otomatis:
   - cache event/reset incremental state direset,
   - Area Filter Log Report direset (data log kembali kosong untuk shift baru),
   - batch data berikutnya dihitung sebagai baseline shift baru.

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
   SENSOR_API_MODE=integrator
   INTEGRATOR_BASE_URL=https://api-platform-integrator.transtrack.co/api/v1/events/
   INTEGRATOR_USERNAME=your_username
   INTEGRATOR_PASSWORD=your_password
   INTEGRATOR_AUTH_MODE=basic
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

### Catatan Integrator API (Transtrack)
Backend akan mengirim request **POST** ke endpoint integrator dengan body:
```
range_date_start = tanggal hari ini 00:00:00 (sesuai TIME_ZONE)
range_date_end   = waktu sekarang (sesuai TIME_ZONE)
range_date_columns = device_time (default)
page = 1
page_size = INTEGRATOR_PAGE_SIZE
filter_columns = INTEGRATOR_FILTER_COLUMNS
filter_value = INTEGRATOR_FILTER_VALUE
```

Jika autentikasi memakai Basic Auth, isi:
```
INTEGRATOR_AUTH_MODE=basic
INTEGRATOR_USERNAME=...
INTEGRATOR_PASSWORD=...
```

Jika autentikasi memakai header khusus (misal Bearer token):
```
INTEGRATOR_AUTH_MODE=header
INTEGRATOR_AUTH_HEADER=Bearer your_token_here
```

Jika integrator memakai **x-token** dan **access_token**:
```
INTEGRATOR_XTOKEN=your_xtoken
INTEGRATOR_ACCESS_TOKEN=your_access_token
```

Jika token sering berubah, gunakan **auto-login**:
```
INTEGRATOR_AUTH_MODE=login
INTEGRATOR_USERNAME=your_username
INTEGRATOR_PASSWORD=your_password
INTEGRATOR_LOGIN_URL=https://api-platform-integrator.transtrack.co/api/v1/vss/auth
```
Backend akan login otomatis lalu memasang:
`Authorization: Bearer <access_token>` dan `x-token: <token>`.

Jika integrator meminta **header dan body** sekaligus:
```
INTEGRATOR_AUTH_MODE=both
INTEGRATOR_USERNAME=...
INTEGRATOR_PASSWORD=...
```

Jika ingin **tanpa filter**, kosongkan:
```
INTEGRATOR_FILTER_COLUMNS=
INTEGRATOR_FILTER_VALUE=
```

### Mode Debug (lihat error log integrator)
Aktifkan debug log jika ingin melihat request/response summary:
```
INTEGRATOR_DEBUG=true
```
Log akan muncul di terminal saat backend berjalan.

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
- Jika memakai API integrator, set `SENSOR_API_MODE=integrator` dan isi `INTEGRATOR_*`.
- Jika realtime API lain sudah siap, set `SENSOR_API_MODE=real` dan isi `SENSOR_API_BASE_URL`.
- Mapping data realtime ke struktur frontend bisa diubah di `src/services/dashboardService.js`.
- `TIME_ZONE` menentukan tanggal/waktu yang dipakai backend (default `Asia/Jakarta`).
- Untuk kebutuhan **total sensor on/off**, backend mendukung API devices-all:
  ```
  DEVICE_HEALTH_MODE=integrator
  INTEGRATOR_DEVICES_URL=https://api-platform-integrator.transtrack.co/api/v1/devices-all
  ```
  Status ON/OFF dihitung dari field `acc` (true = ON).
  Jika belum ada API, bisa pakai **mock** dari env:
  ```
  DEVICE_HEALTH_MODE=mock
  DEVICE_HEALTH_TOTAL=142
  DEVICE_HEALTH_ONLINE=135
  DEVICE_HEALTH_OFFLINE=7
  DEVICE_HEALTH_COVERAGE=95
  ```
  Nanti jika ada API device status, bisa diganti ke mode `cache` atau API khusus.
  - Untuk integrator events: `alert.operator` diambil dari **driver** jika tersedia,
    `alert.fatigue` diambil dari field **event.name** (mis. "Eyes Closing"),
    `alert.photoUrl` diambil dari `alarm_file` (foto pertama jika ada),
    serta `alert.latitude` dan `alert.longitude` diisi dari data GPS.
  - KPI fatigue memakai filter jenis: `FATIGUE_TYPES=Eyes Closing,Yawning`.
  - Window per area (untuk perhitungan KPI):
    ```
    MINING_WINDOW_START=06:00
    MINING_WINDOW_END=18:00
    HAULING_WINDOW_START=05:00
    HAULING_WINDOW_END=17:00
    ```
  - Definisi shift (untuk label shift dan evaluasi shift per area):
    ```
    MINING_SHIFT1_START=06:00
    MINING_SHIFT1_END=17:59
    MINING_SHIFT2_START=18:00
    MINING_SHIFT2_END=05:59
    HAULING_SHIFT1_START=05:00
    HAULING_SHIFT1_END=16:59
    HAULING_SHIFT2_START=17:00
    HAULING_SHIFT2_END=04:59
    ```
  - Catatan perilaku shift:
    - Event integrator dipetakan ke shift berdasarkan waktu event (`time`/`device_time`).
    - Event hanya dipakai jika sesuai dengan **shift aktif sekarang** (berdasarkan `TIME_ZONE`, default `Asia/Makassar`).
    - Label header frontend ditampilkan sebagai `M : Shift X • H : Shift X`.
    - Pada saat shift berganti, backend melakukan reset otomatis state dashboard agar analisa dan monitoring dimulai dari shift aktif yang baru.
  - Persist data trend (otomatis, tidak perlu ETL manual terpisah):
    - `dbo.fatigue_event_raw` diisi otomatis dari payload event integrator (raw JSON) per siklus persist.
    - `dbo.fatigue_event_history` diisi otomatis dari data event yang sudah dinormalisasi (termasuk area/sub_area/shift).
    - Proses insert berjalan bersamaan dengan job persist existing (`PERSIST_INTERVAL_MS`).
  - Filter global data integrator (contoh KPI):
    ```
    INTEGRATOR_FILTER_COLUMNS=manual_verification_is_true_alarm,level
    INTEGRATOR_FILTER_VALUE=true|3
    ```
  - Range waktu integrator (agar sesuai Postman):
    ```
    INTEGRATOR_RANGE_START_TIME=00:00:00
    INTEGRATOR_RANGE_END_MODE=now      # now | end_of_day | fixed
    INTEGRATOR_RANGE_END_TIME=23:11:00 # dipakai jika mode=fixed
    ```
  - Jika total data > 1 halaman, backend dapat mengambil semua halaman:
    ```
    INTEGRATOR_FETCH_ALL_PAGES=true
    INTEGRATOR_MAX_PAGES=0   # 0 = unlimited (ikuti total_pages dari integrator)
    INTEGRATOR_PAGE_SIZE=50
    ```
  - Mode incremental aman (hemat bandwidth + tetap sinkron):
    ```
    INTEGRATOR_INCREMENTAL_ENABLED=true
    INTEGRATOR_INCREMENTAL_OVERLAP_SECONDS=90
    INTEGRATOR_FULL_RESYNC_MINUTES=30
    ```
    Backend akan fetch delta dari request terakhir dengan overlap kecil untuk mencegah miss event,
    lalu melakukan full-sync periodik agar data tetap konsisten dengan sumber.
   - Untuk melihat semua entri di "Area Filter Log Report" (jika > 200), set: `INTEGRATOR_MAX_FILTER_DEBUG_ENTRIES=1000`.
   - Jika request sering timeout, Anda bisa menaikkan batas waktunya: `INTEGRATOR_REQUEST_TIMEOUT_MS=10000` (10 detik).
  - Mapping area bisa disesuaikan dengan keyword/prefix:
    ```
    HAULING_GROUP_KEYWORDS=hauling
    MINING_GROUP_KEYWORDS=mining
    HAULING_UNIT_PREFIXES=HD,WT
    MINING_UNIT_PREFIXES=DT,EX
    ```

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
