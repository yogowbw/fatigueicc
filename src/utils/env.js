const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

const parseIntOrDefault = (value, defaultValue) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const parseList = (value) => {
  if (!value) {
    return '*';
  }

  const parts = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.length ? parts : '*';
};

const sanitizeIdentifier = (value, label) => {
  if (!value) {
    return value;
  }

  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid SQL identifier for ${label}: ${value}`);
  }

  return value;
};

module.exports = {
  parseBoolean,
  parseIntOrDefault,
  parseList,
  sanitizeIdentifier
};
