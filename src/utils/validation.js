const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeZone = (value) => {
  if (!value) {
    return null;
  }

  return String(value).trim().toUpperCase();
};

const normalizeSite = (value) => normalizeZone(value);

const normalizeIsoDate = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  return ISO_DATE_RE.test(trimmed) ? trimmed : null;
};

module.exports = {
  normalizeZone,
  normalizeSite,
  normalizeIsoDate
};
