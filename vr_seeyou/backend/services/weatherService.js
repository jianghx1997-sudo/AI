const axios = require('axios');

const AMAP_WEATHER_URL = 'https://restapi.amap.com/v3/weather/weatherInfo';
const AMAP_IP_URL = 'https://restapi.amap.com/v3/ip';
const AMAP_REGEOCODE_URL = 'https://restapi.amap.com/v3/geocode/regeo';

function getAmapKey() {
  return process.env.AMAP_KEY || process.env.GAODE_API_KEY || process.env.AMAP_WEB_SERVICE_KEY || '';
}

function normalizeLiveWeather(live) {
  if (!live) return null;
  return {
    source: 'amap',
    province: live.province,
    city: live.city,
    adcode: live.adcode,
    weather: live.weather,
    temperature: Number(live.temperature),
    winddirection: live.winddirection,
    windpower: live.windpower,
    humidity: Number(live.humidity),
    reporttime: live.reporttime
  };
}

async function getCurrentWeather(city = process.env.AMAP_CITY || '110101') {
  const key = getAmapKey();
  if (!key) {
    return {
      available: false,
      source: 'manual',
      city,
      message: '未配置高德天气 API Key，可手动输入天气和温度'
    };
  }

  const response = await axios.get(AMAP_WEATHER_URL, {
    params: {
      key,
      city,
      extensions: 'base',
      output: 'JSON'
    },
    proxy: false,
    timeout: 15000
  });

  const data = response.data;
  if (data.status !== '1') {
    throw new Error(data.info || `高德天气查询失败：${data.infocode || 'unknown'}`);
  }

  const live = normalizeLiveWeather(data.lives?.[0]);
  if (!live) {
    throw new Error('高德天气未返回实况数据');
  }

  return {
    available: true,
    ...live
  };
}

async function locateByIp(ip) {
  const key = getAmapKey();
  if (!key) {
    return {
      available: false,
      source: 'manual',
      message: '未配置高德 API Key，无法定位'
    };
  }

  const params = { key, output: 'JSON' };
  if (ip) params.ip = ip;

  const response = await axios.get(AMAP_IP_URL, {
    params,
    proxy: false,
    timeout: 15000
  });

  const data = response.data;
  if (data.status !== '1') {
    throw new Error(data.info || `高德 IP 定位失败：${data.infocode || 'unknown'}`);
  }

  return {
    available: Boolean(data.adcode),
    source: 'amap_ip',
    province: data.province,
    city: data.city,
    adcode: data.adcode,
    rectangle: data.rectangle,
    message: data.adcode ? '' : 'IP 定位未能获取城市编码'
  };
}

async function reverseGeocode(longitude, latitude) {
  const key = getAmapKey();
  if (!key) {
    return {
      available: false,
      source: 'manual',
      message: '未配置高德 API Key，无法逆地理编码'
    };
  }

  if (longitude === undefined || latitude === undefined) {
    throw new Error('缺少经纬度');
  }

  const response = await axios.get(AMAP_REGEOCODE_URL, {
    params: {
      key,
      location: `${longitude},${latitude}`,
      extensions: 'base',
      output: 'JSON'
    },
    proxy: false,
    timeout: 15000
  });

  const data = response.data;
  if (data.status !== '1') {
    throw new Error(data.info || `高德逆地理编码失败：${data.infocode || 'unknown'}`);
  }

  const component = data.regeocode?.addressComponent || {};
  const city = Array.isArray(component.city) ? '' : component.city;

  return {
    available: Boolean(component.adcode),
    source: 'amap_regeo',
    province: component.province,
    city: city || component.district,
    district: component.district,
    adcode: component.adcode,
    formatted_address: data.regeocode?.formatted_address,
    message: component.adcode ? '' : '逆地理编码未能获取城市编码'
  };
}

module.exports = {
  getCurrentWeather,
  locateByIp,
  reverseGeocode
};
