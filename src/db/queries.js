const QUERY_SENSOR_HISTORY = `
SELECT TOP (@limit)
  sensor_id AS sensorId,
  status,
  value,
  recorded_at AS recordedAt,
  received_at AS receivedAt,
  source,
  meta
FROM sensor_readings
WHERE sensor_id = @sensorId
  AND recorded_at >= DATEADD(minute, -@lookbackMinutes, SYSUTCDATETIME())
ORDER BY recorded_at DESC;
`;

const QUERY_LAST_READING = `
SELECT TOP 1
  sensor_id AS sensorId,
  status,
  value,
  recorded_at AS recordedAt,
  received_at AS receivedAt,
  source,
  meta
FROM sensor_readings
WHERE sensor_id = @sensorId
ORDER BY recorded_at DESC;
`;

module.exports = {
  QUERY_SENSOR_HISTORY,
  QUERY_LAST_READING
};
