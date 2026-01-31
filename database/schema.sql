-- Create database (optional)
-- CREATE DATABASE DashboardDB;
-- GO

-- Use database
-- USE DashboardDB;
-- GO

CREATE TABLE sensor_readings (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  sensor_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  value FLOAT NULL,
  recorded_at DATETIME2(3) NOT NULL,
  received_at DATETIME2(3) NOT NULL,
  source VARCHAR(20) NOT NULL,
  meta NVARCHAR(MAX) NULL
);

CREATE INDEX IX_sensor_readings_sensor_time
  ON sensor_readings (sensor_id, recorded_at DESC)
  INCLUDE (status, value, source);

CREATE INDEX IX_sensor_readings_recorded_at
  ON sensor_readings (recorded_at DESC);
