const CATEGORY = {
  TOP: '上衣',
  PANTS: '裤子',
  SKIRT: '裙子',
  OUTER: '外套',
  SHOES: '鞋子',
  ACCESSORY: '配饰'
};

const OCCASION_STYLES = {
  通勤: ['商务', '简约', '正式'],
  正式: ['正式', '商务', '简约'],
  约会: ['优雅', '简约', '休闲'],
  运动: ['运动', '休闲'],
  休闲: ['休闲', '简约', '街头'],
  旅行: ['休闲', '运动', '简约']
};

const NEUTRAL_COLORS = ['黑', '白', '灰', '米', '卡其', '棕', '咖', '藏青', '牛仔'];
const COOL_COLORS = ['蓝', '绿', '青', '紫'];
const WARM_COLORS = ['红', '粉', '橙', '黄', '金'];
const LIGHT_MATERIALS = ['棉', '亚麻', '麻', '天丝', '莱赛尔', '速干', '冰丝', '薄', '透气', '凉感'];
const WARM_MATERIALS = ['羽绒', '羊毛', '羊绒', '抓绒', '毛呢', '棉服', '皮革', '厚', '加绒'];
const LIGHT_ITEM_WORDS = ['短袖', 'T恤', '短裤', '背心', '薄款', '衬衫'];
const WARM_ITEM_WORDS = ['毛衣', '卫衣', '大衣', '羽绒服', '棉服', '厚款'];

const DISLIKE_REASONS = {
  too_hot: ['too_hot', '太热', '闷热', '偏热'],
  too_cold: ['too_cold', '太冷', '偏冷', '不保暖'],
  scene_mismatch: ['scene_mismatch', '不符合场景', '场景不合适'],
  color_mismatch: ['color_mismatch', '颜色不搭', '配色不合适'],
  item_dislike: ['item_dislike', '不喜欢这件', '不喜欢单品']
};

function splitValues(value) {
  return String(value || '')
    .split(/[,，、/|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function textOf(...values) {
  return values.map(value => String(value || '')).join(' ');
}

function hasAny(text, keywords) {
  const source = String(text || '');
  return keywords.some(keyword => source.includes(keyword));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function includesValue(value, target) {
  if (!target) return true;
  const source = String(value || '');
  const values = splitValues(value);
  return values.some(item => item === target || item.includes(target) || target.includes(item)) || source.includes(target);
}

function getTemperature(weather = {}) {
  const temperature = Number(weather.temperature);
  return Number.isFinite(temperature) ? temperature : null;
}

function getWeatherText(weather = {}) {
  return textOf(weather.weather, weather.dayweather, weather.nightweather);
}

function getColorFamily(color) {
  const source = String(color || '');
  if (!source) return 'unknown';
  if (hasAny(source, NEUTRAL_COLORS)) return 'neutral';
  if (hasAny(source, COOL_COLORS)) return 'cool';
  if (hasAny(source, WARM_COLORS)) return 'warm';
  return 'accent';
}

function hasSeason(item, target) {
  const season = String(item.season || '');
  if (target === '春/秋') return season.includes('春') || season.includes('秋');
  return season.includes(target);
}

function normalizeRecommendationContext(context = {}) {
  const weather = context.weather || {};
  const temperature = getTemperature(weather);
  const weatherText = getWeatherText(weather);
  const band =
    temperature === null ? 'mild' :
    temperature <= 12 ? 'cold' :
    temperature <= 20 ? 'cool' :
    temperature <= 27 ? 'mild' :
    'hot';
  const weatherRisk = {
    rain: hasAny(weatherText, ['雨', '雷阵雨', '阵雨']),
    snow: hasAny(weatherText, ['雪']),
    wind: hasAny(weatherText, ['风']),
    cold: band === 'cold',
    hot: band === 'hot'
  };

  return {
    occasion: context.occasion || '休闲',
    weather,
    temperature,
    band,
    weatherText,
    weatherRisk,
    occasionStyles: OCCASION_STYLES[context.occasion || '休闲'] || []
  };
}

function getWearTemplate(context) {
  if (context.band === 'cold') {
    return {
      key: 'cold_layered',
      label: '低温保暖',
      requiredRoles: ['top', 'bottom', 'outer', 'shoes'],
      optionalRoles: ['accessory'],
      includeOuter: true,
      comfortGoal: '保暖'
    };
  }

  if (context.band === 'cool') {
    return {
      key: 'cool_layered',
      label: '微凉层次',
      requiredRoles: ['top', 'bottom', 'shoes'],
      optionalRoles: ['outer', 'accessory'],
      includeOuter: true,
      comfortGoal: '可叠穿'
    };
  }

  if (context.band === 'hot') {
    return {
      key: 'hot_light',
      label: '高温轻爽',
      requiredRoles: ['top', 'bottom', 'shoes'],
      optionalRoles: ['accessory'],
      includeOuter: false,
      comfortGoal: '透气'
    };
  }

  return {
    key: 'mild_daily',
    label: '今日实穿',
    requiredRoles: ['top', 'bottom', 'shoes'],
    optionalRoles: ['accessory'],
    includeOuter: false,
    comfortGoal: '舒适'
  };
}

function categoryRole(item) {
  if (item.category === CATEGORY.TOP) return 'top';
  if (item.category === CATEGORY.OUTER) return 'outer';
  if (item.category === CATEGORY.SHOES) return 'shoes';
  if (item.category === CATEGORY.ACCESSORY) return 'accessory';
  if (item.category === CATEGORY.PANTS || item.category === CATEGORY.SKIRT) return 'bottom';
  return 'other';
}

function itemSearchText(item) {
  return textOf(item.name, item.category, item.color, item.season, item.material, item.style, item.occasion, item.tags);
}

function deriveItemAttributes(item) {
  const text = itemSearchText(item);
  const role = categoryRole(item);
  let warmth = 2.3;
  let breathability = 3;
  let formality = 2.2;

  if (role === 'outer') warmth += 1.3;
  if (hasSeason(item, '冬季')) warmth += 1.2;
  if (hasSeason(item, '夏季')) warmth -= 0.8;
  if (hasSeason(item, '春/秋')) warmth += 0.2;
  if (hasAny(text, WARM_MATERIALS) || hasAny(text, WARM_ITEM_WORDS)) warmth += 1.2;
  if (hasAny(text, LIGHT_MATERIALS) || hasAny(text, LIGHT_ITEM_WORDS)) warmth -= 0.9;

  if (hasSeason(item, '夏季')) breathability += 0.7;
  if (hasAny(text, LIGHT_MATERIALS) || hasAny(text, LIGHT_ITEM_WORDS)) breathability += 1.2;
  if (hasAny(text, WARM_MATERIALS) || hasAny(text, WARM_ITEM_WORDS)) breathability -= 1.2;
  if (role === 'outer') breathability -= 0.7;

  if (hasAny(text, ['商务', '正式', '西装'])) formality += 2;
  if (hasAny(text, ['简约', '衬衫', '西裤'])) formality += 0.9;
  if (hasAny(text, ['运动', '速干'])) formality -= 1.1;
  if (hasAny(text, ['休闲', '街头', '牛仔'])) formality -= 0.2;

  const storedRole = ['top', 'bottom', 'outer', 'shoes', 'accessory'].includes(item.layering_role)
    ? item.layering_role
    : role;
  const storedColorFamily = ['neutral', 'cool', 'warm', 'accent', 'unknown'].includes(item.color_family)
    ? item.color_family
    : getColorFamily(item.color);
  const storedWarmth = Number(item.warmth_level);
  const storedBreathability = Number(item.breathability_level);
  const storedFormality = Number(item.formality_level);
  const weatherRiskText = String(item.weather_risk || '');

  return {
    warmth_level: Number.isFinite(storedWarmth) ? clamp(round(storedWarmth, 1), 1, 5) : clamp(round(warmth, 1), 1, 5),
    breathability_level: Number.isFinite(storedBreathability) ? clamp(round(storedBreathability, 1), 1, 5) : clamp(round(breathability, 1), 1, 5),
    formality_level: Number.isFinite(storedFormality) ? clamp(round(storedFormality, 1), 1, 5) : clamp(round(formality, 1), 1, 5),
    layering_role: storedRole,
    color_family: storedColorFamily,
    weather_risk: {
      rain_light_color: hasAny(String(item.color || ''), ['白', '浅', '米']) && storedRole !== 'accessory',
      heavy_in_heat: (Number.isFinite(storedWarmth) ? storedWarmth : warmth) >= 4 || hasAny(weatherRiskText, ['高温', '闷热', '厚']),
      thin_in_cold: (Number.isFinite(storedWarmth) ? storedWarmth : warmth) <= 2 || hasAny(weatherRiskText, ['低温', '偏薄', '不保暖'])
    }
  };
}

function enrichClothes(clothes) {
  return clothes.map(item => ({
    ...item,
    recommendation_attributes: deriveItemAttributes(item)
  }));
}

function parseItemIds(value) {
  if (Array.isArray(value)) {
    return value.map(id => Number(id)).filter(Number.isFinite);
  }

  const raw = String(value || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(id => Number(id)).filter(Number.isFinite);
    }
  } catch (error) {
    // Historical logs may be comma separated instead of JSON.
  }

  return splitValues(raw).map(id => Number(id)).filter(Number.isFinite);
}

function addWeight(map, key, delta) {
  if (!key) return;
  map.set(key, round((map.get(key) || 0) + delta, 2));
}

function normalizeFeedbackReason(log) {
  const raw = textOf(log.feedback_reason, log.note).toLowerCase();
  for (const [key, values] of Object.entries(DISLIKE_REASONS)) {
    if (values.some(value => raw.includes(String(value).toLowerCase()))) return key;
  }
  return '';
}

function buildPreferenceProfile(clothes, logs = []) {
  const itemById = new Map(clothes.map(item => [Number(item.id), item]));
  const profile = {
    itemWeights: new Map(),
    colorWeights: new Map(),
    styleWeights: new Map(),
    comboWeights: new Map(),
    comfort: {
      avoidWarmth: 0,
      preferWarmth: 0,
      preferBreathability: 0,
      sceneStrictness: 0,
      colorStrictness: 0
    },
    totalSignals: 0
  };

  logs.slice(0, 120).forEach((log, index) => {
    const ids = parseItemIds(log.item_ids);
    if (ids.length === 0) return;

    const recency = Math.max(0.2, 1 - index * 0.012);
    const feedback = log.feedback || 'viewed';
    const reason = normalizeFeedbackReason(log);
    const base =
      feedback === 'liked' ? 1.1 :
      feedback === 'worn' ? 1 :
      feedback === 'disliked' ? -1.3 :
      0;

    if (base === 0) return;

    let delta = round(base * recency, 2);
    if (feedback === 'disliked' && reason === 'item_dislike') delta *= 1.35;

    const signature = ids.map(String).sort().join('|');
    addWeight(profile.comboWeights, signature, delta);

    ids.forEach(id => {
      const item = itemById.get(Number(id));
      addWeight(profile.itemWeights, String(id), delta);
      if (!item) return;

      const colorFactor = feedback === 'disliked' && reason === 'color_mismatch' ? 0.9 : 0.35;
      const styleFactor = feedback === 'disliked' && reason === 'scene_mismatch' ? 0.9 : 0.45;
      addWeight(profile.colorWeights, item.color, delta * colorFactor);
      addWeight(profile.styleWeights, item.style, delta * styleFactor);
    });

    if (feedback === 'disliked') {
      if (reason === 'too_hot') {
        profile.comfort.avoidWarmth += recency;
        profile.comfort.preferBreathability += recency * 0.8;
      }
      if (reason === 'too_cold') {
        profile.comfort.preferWarmth += recency;
      }
      if (reason === 'scene_mismatch') profile.comfort.sceneStrictness += recency;
      if (reason === 'color_mismatch') profile.comfort.colorStrictness += recency;
    }

    profile.totalSignals += 1;
  });

  return profile;
}

module.exports = {
  CATEGORY,
  hasAny,
  clamp,
  round,
  includesValue,
  getColorFamily,
  hasSeason,
  normalizeRecommendationContext,
  getWearTemplate,
  itemSearchText,
  deriveItemAttributes,
  enrichClothes,
  buildPreferenceProfile
};
