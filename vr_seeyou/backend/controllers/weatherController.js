const { getCurrentWeather, locateByIp, reverseGeocode } = require('../services/weatherService');

function normalizeClientIp(ip = '') {
  return String(ip).replace(/^::ffff:/, '').trim();
}

function isPrivateOrLocalIp(ip = '') {
  const value = normalizeClientIp(ip);
  if (!value || value === '::1' || value === '127.0.0.1' || value === 'localhost') return true;
  if (value.startsWith('10.') || value.startsWith('192.168.')) return true;

  const match = value.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

async function getCurrentWeatherHandler(req, res) {
  try {
    const weather = await getCurrentWeather(req.query.city);
    res.json({ success: true, data: weather });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function locateByIpHandler(req, res) {
  try {
    const forwarded = req.headers['x-forwarded-for'];
    const detectedIp = req.query.ip || (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket.remoteAddress;
    const ip = isPrivateOrLocalIp(detectedIp) ? '' : normalizeClientIp(detectedIp);
    const location = await locateByIp(ip);
    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function reverseGeocodeHandler(req, res) {
  try {
    const location = await reverseGeocode(req.query.longitude, req.query.latitude);
    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getCurrentWeatherHandler,
  locateByIpHandler,
  reverseGeocodeHandler
};
