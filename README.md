# Safety Dashboard SQL Backend

Backend ini menyediakan API untuk data dashboard safety (React) dengan sumber
data dari Microsoft SQL Server. API sudah disiapkan agar struktur responsnya
mirip dengan data statis di frontend.

## Prasyarat

- Node.js 18+ (disarankan 20+)
- SQL Server yang berisi view sesuai kontrak di bawah

## Setup

```bash
npm install
cp .env.example .env
```

Isi konfigurasi koneksi database pada `.env`.

## Menjalankan Server

```bash
npm start
```

Server berjalan pada `http://localhost:4000` (default).

## Health Check

```
GET /health
```

Jika koneksi database ok akan mengembalikan:

```json
{ "status": "ok" }
```

## Endpoint Utama

- `GET /api/dashboard`  
  Mengembalikan semua dataset sekaligus.
- `GET /api/dashboard/stream`  
  SSE untuk update real time tanpa refresh.

- `GET /api/site-trends?zone=ALL`
- `GET /api/aifr`
- `GET /api/incident-distribution?zone=ADMO`
- `GET /api/incident-causes?zone=HAULING`
- `GET /api/hourly-fatigue?date=2026-01-15`
- `GET /api/monitoring-risks`
- `GET /api/risky-operators`
- `GET /api/incident-locations`
- `GET /api/sensor-status`
- `GET /api/hazard/per-site`
- `GET /api/hazard/monthly?site=ADMO`
- `GET /api/hazard/follow-up`
- `GET /api/leading-gauges`
- `GET /api/safety-kpis`
- `GET /api/monitoring-summary`
- `GET /api/strategic-score`
- `GET /api/weather`
- `GET /api/announcements`
- `GET /api/dashboard-meta`
- `GET /api/calendar-meta`
- `GET /api/calendar-events`

Catatan:
- Jika `zone` atau `site` tidak dikirim, endpoint akan mengembalikan data
  untuk semua zona/site (object dengan key nama zona).
- Format `date` harus `YYYY-MM-DD`.

## Realtime (SSE)

Backend menyediakan Server Sent Events (SSE) di:

```
GET /api/dashboard/stream
```

Konfigurasi interval bisa diatur lewat `.env`:

```
DASHBOARD_STREAM_INTERVAL_MS=5000
SSE_KEEP_ALIVE_MS=15000
SSE_RETRY_MS=3000
```

## Kontrak View SQL Server

Silakan buat view (atau table) dengan nama sesuai `.env` dan kolom berikut.
Backend menggunakan query `SELECT` langsung dari view.

### 1. `vw_site_trend`
Kolom wajib:

| kolom      | tipe     | keterangan                 |
|----------- |----------|----------------------------|
| zone       | varchar  | ALL, MINING, HAULING, dll  |
| name       | varchar  | nama bulan (Jan, Feb, ...) |
| nm         | int      | Near Miss                  |
| incident   | int      | Incident                   |
| total      | int      | Total                      |
| sort_order | int      | urutan bulan               |

### 2. `vw_aifr`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| name  | varchar | label site |
| value | decimal | AIFR       |

### 3. `vw_incident_distribution`

| kolom      | tipe    | keterangan |
|------------|---------|------------|
| zone       | varchar | ALL, MINING, dll |
| name       | varchar | area name |
| value      | int     | jumlah    |
| sort_order | int     | urutan    |

### 4. `vw_incident_cause`

| kolom      | tipe     | keterangan |
|------------|----------|------------|
| zone       | varchar  | ALL, MINING, dll |
| name       | varchar  | cause name |
| value      | decimal  | persen     |
| color      | varchar  | optional warna hex |
| sort_order | int      | urutan     |

Jika `color` kosong, backend akan memberi warna default.

### 5. `vw_hourly_fatigue`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| date  | date    | optional filter |
| hour  | varchar | 06:00, 07:00 |
| today | int     | kejadian hari ini |
| avg   | int     | rata-rata |

### 6. `vw_monitoring_risk`

| kolom    | tipe    | keterangan |
|----------|---------|------------|
| id       | int     | unique id |
| unit     | varchar | unit name |
| driver   | varchar | driver name |
| type     | varchar | event type |
| time     | varchar | HH:mm |
| location | varchar | lokasi |
| history  | varchar | riwayat |
| risk     | varchar | LOW/MED/HIGH/CRITICAL |
| status   | varchar | Open/Ack/Closed |
| weather  | varchar | rain/clear/cloudy |

### 7. `vw_risky_operators`

| kolom  | tipe    | keterangan |
|--------|---------|------------|
| rank   | int     | ranking |
| name   | varchar | operator |
| unit   | varchar | unit |
| alerts | int     | jumlah alert |
| score  | int     | score |

### 8. `vw_incident_locations`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| name  | varchar | lokasi |
| count | int     | jumlah |
| level | varchar | Critical/High/Medium/Low |

### 9. `vw_sensor_status`

| kolom  | tipe    | keterangan |
|--------|---------|------------|
| status | varchar | Online/Offline/Maint |
| value  | int     | jumlah unit |

### 10. `vw_hazard_per_site`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| name  | varchar | ADMO/MACO/SERA |
| plan  | int     | plan |
| actual| int     | actual |
| ach   | decimal | achievement (%) |

### 11. `vw_hazard_monthly`

| kolom      | tipe    | keterangan |
|------------|---------|------------|
| site       | varchar | ADMO/MACO/SERA |
| name       | varchar | bulan |
| plan       | int     | plan |
| actual     | int     | actual |
| ach        | decimal | achievement |
| sort_order | int     | urutan bulan |

### 12. `vw_hazard_follow_up`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| name  | varchar | ADMO/MACO/SERA/ALL |
| plan  | int     | plan |
| actual| int     | actual |
| ach   | decimal | achievement |

### 13. `vw_leading_gauges`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| title | varchar | label gauge |
| value | int     | persentase |

### 14. `vw_calendar_events`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| day   | int     | hari dalam bulan |
| type  | varchar | FAI, EI, etc |
| site  | varchar | ADMO/MACO/SERA |
| color | varchar | nama warna |

### 15. `vw_safety_kpis`

| kolom | tipe    | keterangan |
|-------|---------|------------|
| key   | varchar | FATALITY/KAPTK/LTI/MTI/FAI/PD/EI/NM |
| value | int     | nilai KPI |

### 16. `vw_monitoring_summary`

| kolom   | tipe    | keterangan |
|---------|---------|------------|
| key     | varchar | FATIGUE/OVERSPEED/DISTRACTION/PROXIMITY |
| value   | int     | nilai |
| unit    | varchar | Today/Events/Cases/etc |
| trend   | varchar | up/down/flat |
| subtext | varchar | teks ringkas |

### 17. `vw_strategic_score`

| kolom   | tipe    | keterangan |
|---------|---------|------------|
| score   | int     | score |
| label   | varchar | Moderate/High/etc |
| subtext | varchar | deskripsi |
| color   | varchar | green/yellow/red |

### 18. `vw_weather_status`

| kolom       | tipe    | keterangan |
|-------------|---------|------------|
| temperature | decimal | suhu (C) |
| condition   | varchar | kondisi |
| wind_speed  | decimal | kecepatan angin (km/h) |
| humidity    | int     | kelembapan (%) |
| alert_text  | varchar | pesan alert |
| alert_level | varchar | high/medium/low |

### 19. `vw_announcements`

| kolom      | tipe    | keterangan |
|------------|---------|------------|
| message    | varchar | pesan berjalan |
| sort_order | int     | urutan |

### 20. `vw_dashboard_meta`

| kolom       | tipe    | keterangan |
|-------------|---------|------------|
| last_update | datetime | waktu update terakhir |

### 21. `vw_calendar_meta`

| kolom        | tipe    | keterangan |
|--------------|---------|------------|
| year         | int     | tahun |
| month        | int     | 1-12 |
| month_name   | varchar | JANUARY, FEBRUARY, ... |
| start_day    | int     | index hari (0=Mon) |
| days_in_month| int     | jumlah hari |

## Catatan Implementasi

- Nama view bisa diubah lewat `.env`.
- Endpoint mengembalikan data dalam format yang sama seperti dataset
  di frontend.
