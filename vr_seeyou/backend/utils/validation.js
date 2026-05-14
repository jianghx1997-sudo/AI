const LEVEL_FIELDS = ['warmth_level', 'breathability_level', 'formality_level'];
const LAYERING_ROLES = new Set(['top', 'bottom', 'outer', 'shoes', 'accessory']);
const COLOR_FAMILIES = new Set(['neutral', 'cool', 'warm', 'accent', 'unknown']);
const FEEDBACK_TYPES = new Set(['viewed', 'liked', 'worn', 'disliked']);

const STRING_LIMITS = {
  name: 80,
  brand: 80,
  purchase_date: 32,
  category: 32,
  color: 40,
  season: 40,
  material: 80,
  style: 80,
  occasion: 120,
  fit: 40,
  layering_role: 24,
  color_family: 24,
  weather_risk: 160,
  tags: 500,
  source: 40,
  weather: 40,
  city: 80,
  outfit_key: 160,
  outfit_name: 120,
  feedback_reason: 120,
  note: 300
};

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

function addString(value, field, output, errors, { required = false, max = STRING_LIMITS[field] || 120 } = {}) {
  if (isBlank(value)) {
    if (required) errors.push(`${field} is required`);
    else output[field] = null;
    return;
  }

  const normalized = normalizeString(value);
  if (normalized.length > max) {
    errors.push(`${field} must be ${max} characters or less`);
    return;
  }

  output[field] = normalized;
}

function addNumber(value, field, output, errors, { min, max, integer = false, required = false } = {}) {
  if (isBlank(value)) {
    if (required) errors.push(`${field} is required`);
    else output[field] = null;
    return;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push(`${field} must be a number`);
    return;
  }
  if (integer && !Number.isInteger(number)) {
    errors.push(`${field} must be an integer`);
    return;
  }
  if (min !== undefined && number < min) {
    errors.push(`${field} must be at least ${min}`);
    return;
  }
  if (max !== undefined && number > max) {
    errors.push(`${field} must be at most ${max}`);
    return;
  }

  output[field] = number;
}

function addEnum(value, field, allowed, output, errors, { required = false } = {}) {
  if (isBlank(value)) {
    if (required) errors.push(`${field} is required`);
    else output[field] = null;
    return;
  }

  const normalized = normalizeString(value);
  if (!allowed.has(normalized)) {
    errors.push(`${field} has an unsupported value`);
    return;
  }

  output[field] = normalized;
}

function validateUploadPath(value, output, errors, { required = false } = {}) {
  if (isBlank(value)) {
    if (required) errors.push('image_path is required');
    return;
  }

  const normalized = normalizeString(value).replace(/\\/g, '/');
  if (!normalized.startsWith('/uploads/') || normalized.includes('..')) {
    errors.push('image_path must be a safe /uploads path');
    return;
  }

  output.image_path = normalized;
}

function validateClothPayload(input = {}, { partial = false, requireName = false, requireImage = false } = {}) {
  const errors = [];
  const output = {};

  if (Object.prototype.hasOwnProperty.call(input, 'name') || requireName) {
    addString(input.name, 'name', output, errors, { required: requireName || Object.prototype.hasOwnProperty.call(input, 'name') });
  }
  if (Object.prototype.hasOwnProperty.call(input, 'image_path') || requireImage) {
    validateUploadPath(input.image_path, output, errors, { required: requireImage || Object.prototype.hasOwnProperty.call(input, 'image_path') });
  }

  [
    'brand',
    'purchase_date',
    'category',
    'color',
    'season',
    'material',
    'style',
    'occasion',
    'fit',
    'weather_risk',
    'tags',
    'source'
  ].forEach(field => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      addString(input[field], field, output, errors);
    }
  });

  LEVEL_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      addNumber(input[field], field, output, errors, { min: 1, max: 5 });
    }
  });

  if (Object.prototype.hasOwnProperty.call(input, 'confidence')) {
    addNumber(input.confidence, 'confidence', output, errors, { min: 0, max: 1 });
  }
  if (Object.prototype.hasOwnProperty.call(input, 'layering_role')) {
    addEnum(input.layering_role, 'layering_role', LAYERING_ROLES, output, errors);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'color_family')) {
    addEnum(input.color_family, 'color_family', COLOR_FAMILIES, output, errors);
  }

  return { ok: errors.length === 0, value: output, errors };
}

function parseBooleanParam(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value === true || value === 'true' || value === '1';
}

function validateRecommendationQuery(query = {}) {
  const errors = [];
  const output = {
    aiReviewEnabled: parseBooleanParam(query.aiReview, false),
    useWeather: parseBooleanParam(query.useWeather, false),
    occasion: isBlank(query.occasion) ? '休闲' : normalizeString(query.occasion),
    weather: {
      source: 'manual',
      weather: isBlank(query.weather) ? '晴' : normalizeString(query.weather),
      temperature: 22,
      city: isBlank(query.city) ? '' : normalizeString(query.city)
    }
  };

  if (output.occasion.length > STRING_LIMITS.occasion) errors.push('occasion is too long');
  if (output.weather.weather.length > STRING_LIMITS.weather) errors.push('weather is too long');
  if (output.weather.city.length > STRING_LIMITS.city) errors.push('city is too long');

  if (!isBlank(query.temperature)) {
    addNumber(query.temperature, 'temperature', output.weather, errors, { min: -50, max: 60 });
  }
  if (!isBlank(query.humidity)) {
    addNumber(query.humidity, 'humidity', output.weather, errors, { min: 0, max: 100 });
  }

  return { ok: errors.length === 0, value: output, errors };
}

function validateRecommendationFeedback(body = {}) {
  const errors = [];
  const output = {};

  addEnum(body.feedback, 'feedback', FEEDBACK_TYPES, output, errors, { required: true });
  addString(body.outfit_key || body.snapshot_outfit_key, 'outfit_key', output, errors);
  addString(body.outfit_name, 'outfit_name', output, errors);
  addString(body.occasion, 'occasion', output, errors);
  addString(body.weather, 'weather', output, errors);
  addString(body.feedback_reason || body.reason, 'feedback_reason', output, errors);
  addString(body.note, 'note', output, errors);

  if (!isBlank(body.temperature)) {
    addNumber(body.temperature, 'temperature', output, errors, { min: -50, max: 60 });
  }
  if (!isBlank(body.recommendation_snapshot_id)) {
    addNumber(body.recommendation_snapshot_id, 'recommendation_snapshot_id', output, errors, {
      min: 1,
      integer: true
    });
  }

  return { ok: errors.length === 0, value: output, errors };
}

function sendValidationError(res, errors) {
  return res.status(400).json({
    success: false,
    error: errors[0] || 'Invalid request',
    errors
  });
}

module.exports = {
  validateClothPayload,
  validateRecommendationQuery,
  validateRecommendationFeedback,
  sendValidationError
};
