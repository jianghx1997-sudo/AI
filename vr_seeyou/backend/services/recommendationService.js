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

  return {
    warmth_level: clamp(round(warmth, 1), 1, 5),
    breathability_level: clamp(round(breathability, 1), 1, 5),
    formality_level: clamp(round(formality, 1), 1, 5),
    layering_role: role,
    color_family: getColorFamily(item.color),
    weather_risk: {
      rain_light_color: hasAny(String(item.color || ''), ['白', '浅', '米']) && role !== 'accessory',
      heavy_in_heat: warmth >= 4 || role === 'outer',
      thin_in_cold: warmth <= 2
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

function recentWearScore(item) {
  const lastWorn = item.last_worn ? new Date(item.last_worn).getTime() : 0;
  if (!lastWorn || Number.isNaN(lastWorn)) {
    return { score: 0.3, note: '近期未穿，可提高利用率' };
  }

  const days = (Date.now() - lastWorn) / (1000 * 60 * 60 * 24);
  if (days <= 3) return { score: -1.2, note: '最近刚穿过，适当降权' };
  if (days <= 7) return { score: -0.55, note: '一周内穿过，轻微降权' };
  return { score: 0.3, note: '近期未重复，适合作为候选' };
}

function seasonFitScore(item, context) {
  if (context.temperature === null) return { score: 0.6, note: '无明确温度，按常规季节适配' };

  if (context.band === 'cold') {
    if (hasSeason(item, '冬季')) return { score: 2.4, note: '季节适合低温' };
    if (hasSeason(item, '四季') || hasSeason(item, '春/秋')) return { score: 0.8, note: '低温下可叠穿' };
    return { score: -1.8, note: '低温下偏薄' };
  }

  if (context.band === 'cool') {
    if (hasSeason(item, '春/秋') || hasSeason(item, '四季')) return { score: 2, note: '适合微凉天气' };
    if (hasSeason(item, '冬季')) return { score: 0.2, note: '当前温度下可能略厚' };
    return { score: -0.4, note: '微凉天气下可能偏薄' };
  }

  if (context.band === 'hot') {
    if (hasSeason(item, '夏季')) return { score: 2.4, note: '适合高温' };
    if (hasSeason(item, '四季')) return { score: 0.8, note: '高温下勉强可用' };
    return { score: -1.8, note: '高温下可能偏厚' };
  }

  if (hasSeason(item, '夏季') || hasSeason(item, '春/秋') || hasSeason(item, '四季')) {
    return { score: 1.7, note: '适合温和天气' };
  }
  return { score: -0.8, note: '当前温度下可能偏厚' };
}

function comfortFitScore(item, context, profile) {
  const attrs = item.recommendation_attributes;
  let score = 0;
  const notes = [];

  if (context.band === 'hot') {
    score += attrs.breathability_level * 0.9;
    score -= attrs.warmth_level * 0.8;
    if (attrs.breathability_level >= 4) notes.push('透气度较好');
    if (attrs.warmth_level >= 4) notes.push('高温下偏厚');
  } else if (context.band === 'cold') {
    score += attrs.warmth_level * 0.95;
    if (attrs.warmth_level >= 4) notes.push('保暖度较好');
    if (attrs.warmth_level <= 2) notes.push('低温下偏薄');
  } else if (context.band === 'cool') {
    score += 2.6 - Math.abs(attrs.warmth_level - 3) * 0.8;
    score += attrs.breathability_level * 0.18;
    notes.push('适合分层穿着');
  } else {
    score += 2.4 - Math.abs(attrs.warmth_level - 2.7) * 0.45;
    score += attrs.breathability_level * 0.25;
  }

  score -= profile.comfort.avoidWarmth * attrs.warmth_level * 0.16;
  score += profile.comfort.preferWarmth * attrs.warmth_level * 0.14;
  score += profile.comfort.preferBreathability * attrs.breathability_level * 0.16;

  return { score: round(score, 2), notes };
}

function occasionFitScore(item, context, profile) {
  const attrs = item.recommendation_attributes;
  let score = 0;
  const notes = [];

  if (includesValue(item.occasion, context.occasion)) {
    score += 2.5;
    notes.push(`适配${context.occasion}场景`);
  } else if (context.occasionStyles.some(style => includesValue(item.style, style))) {
    score += 1.3;
    notes.push(`风格可支撑${context.occasion}`);
  } else {
    score -= 0.5 + profile.comfort.sceneStrictness * 0.2;
  }

  if (context.occasion === '通勤' || context.occasion === '正式') {
    score += (attrs.formality_level - 2.5) * 0.65;
    if (attrs.formality_level >= 3.5) notes.push('正式度较稳');
  }

  if (context.occasion === '运动') {
    score += attrs.breathability_level * 0.35;
    if (hasAny(itemSearchText(item), ['运动', '速干', '休闲'])) score += 1;
  }

  return { score: round(score, 2), notes };
}

function scoreItem(item, context, role, profile) {
  const season = seasonFitScore(item, context);
  const comfort = comfortFitScore(item, context, profile);
  const occasion = occasionFitScore(item, context, profile);
  const wear = recentWearScore(item);
  const attrs = item.recommendation_attributes;
  const breakdown = {
    weather: season.score,
    comfort: comfort.score,
    occasion: occasion.score,
    preference: 0,
    wear: wear.score,
    category: role === attrs.layering_role ? 0.5 : 0
  };
  const notes = [...season.note ? [season.note] : [], ...comfort.notes, ...occasion.notes, wear.note].filter(Boolean);

  if (item.is_favorite) {
    breakdown.preference += 0.8;
    notes.push('收藏单品优先');
  }

  const itemWeight = profile.itemWeights.get(String(item.id)) || 0;
  const colorWeight = profile.colorWeights.get(item.color) || 0;
  const styleWeight = profile.styleWeights.get(item.style) || 0;
  breakdown.preference += clamp(itemWeight + colorWeight + styleWeight, -2.6, 2.6);

  if ((context.weatherRisk.rain || context.weatherRisk.snow) && attrs.weather_risk.rain_light_color) {
    breakdown.weather -= 0.5;
    notes.push('雨雪天浅色耐脏风险较高');
  }

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return {
    item,
    role,
    score: round(score, 2),
    breakdown,
    notes,
    hard_warnings: [],
    hard_penalty: 0
  };
}

function sortCandidates(items, context, role, profile) {
  return items
    .map(item => scoreItem(item, context, role, profile))
    .sort((a, b) => b.score - a.score || Number(b.item.is_favorite || 0) - Number(a.item.is_favorite || 0));
}

function buildRawPools(clothes, context, profile) {
  const byCategory = category => clothes.filter(item => item.category === category);
  const pants = sortCandidates(byCategory(CATEGORY.PANTS), context, 'bottom', profile);
  const skirts = sortCandidates(byCategory(CATEGORY.SKIRT), context, 'bottom', profile);

  return {
    tops: sortCandidates(byCategory(CATEGORY.TOP), context, 'top', profile),
    pants,
    skirts,
    bottoms: [...pants, ...skirts].sort((a, b) => b.score - a.score),
    outers: sortCandidates(byCategory(CATEGORY.OUTER), context, 'outer', profile),
    shoes: sortCandidates(byCategory(CATEGORY.SHOES), context, 'shoes', profile),
    accessories: sortCandidates(byCategory(CATEGORY.ACCESSORY), context, 'accessory', profile)
  };
}

function markFallbackCandidates(candidates, message, penalty = 3) {
  return candidates.map(candidate => ({
    ...candidate,
    hard_penalty: candidate.hard_penalty + penalty,
    hard_warnings: [...candidate.hard_warnings, message]
  }));
}

function hardFilterRole(role, candidates, context) {
  if (!candidates.length) return { candidates, warnings: [] };

  const warnings = [];
  const accepted = candidates.filter(candidate => {
    const attrs = candidate.item.recommendation_attributes;
    if (context.band === 'hot' && role === 'outer') return false;
    if (context.band === 'hot' && role !== 'shoes' && attrs.warmth_level >= 4.3) return false;
    return true;
  });

  if (accepted.length > 0) return { candidates: accepted, warnings };

  const message =
    context.band === 'hot' && role === 'outer'
      ? '高温天气不推荐外套，已跳过外套层'
      : '当前衣橱缺少完全适合天气的单品，已降级使用现有候选';
  warnings.push(message);
  return {
    candidates: context.band === 'hot' && role === 'outer'
      ? []
      : markFallbackCandidates(candidates, message),
    warnings
  };
}

function applyHardFilters(rawPools, context) {
  const warnings = [];
  const filtered = {};

  Object.entries(rawPools).forEach(([key, candidates]) => {
    const role =
      key === 'tops' ? 'top' :
      key === 'bottoms' || key === 'pants' || key === 'skirts' ? 'bottom' :
      key === 'outers' ? 'outer' :
      key === 'shoes' ? 'shoes' :
      'accessory';
    const result = hardFilterRole(role, candidates, context);
    filtered[key] = result.candidates;
    warnings.push(...result.warnings);
  });

  return { pools: filtered, warnings: [...new Set(warnings)] };
}

function listOrNull(candidates, limit, required) {
  const sliced = candidates.slice(0, limit);
  if (sliced.length) return sliced;
  return required ? [null] : [null];
}

function combinationSignature(candidates) {
  return candidates
    .filter(Boolean)
    .map(candidate => candidate.item.id)
    .sort((a, b) => a - b)
    .join('|');
}

function generateCandidateOutfits(pools, context, template) {
  const topChoices = listOrNull(pools.tops, 3, true);
  const bottomChoices = listOrNull(pools.bottoms, 3, true);
  const shoeChoices = listOrNull(pools.shoes, 2, true);
  const outerChoices = template.includeOuter ? listOrNull(pools.outers, 2, template.requiredRoles.includes('outer')) : [null];
  const accessoryChoices = [null, ...pools.accessories.slice(0, 1)];
  const combos = [];
  const seen = new Set();

  for (const outer of outerChoices) {
    for (const top of topChoices) {
      for (const bottom of bottomChoices) {
        for (const shoes of shoeChoices) {
          for (const accessory of accessoryChoices) {
            const rankedItems = [outer, top, bottom, shoes, accessory].filter(Boolean);
            const signature = combinationSignature(rankedItems);
            if (!signature || seen.has(signature)) continue;
            seen.add(signature);
            combos.push({ rankedItems });
            if (combos.length >= 10) return combos;
          }
        }
      }
    }
  }

  return combos;
}

function colorHarmony(items, profile) {
  const colors = items.map(item => item.color).filter(Boolean);
  if (colors.length <= 1) {
    return { score: colors.length ? 74 : 58, notes: colors.length ? ['配色简单稳定'] : ['颜色信息不足'] };
  }

  const families = colors.map(getColorFamily);
  const uniqueFamilies = new Set(families);
  const neutralCount = families.filter(family => family === 'neutral').length;
  const accentCount = families.filter(family => family === 'warm' || family === 'accent').length;
  let score = 68;
  const notes = [];

  if (neutralCount > 0) {
    score += 12;
    notes.push('中性色降低搭配风险');
  }

  if (uniqueFamilies.size <= 2) {
    score += 10;
    notes.push('颜色关系较集中');
  } else {
    score -= 8 + profile.comfort.colorStrictness * 1.5;
    notes.push('颜色层次较多，建议实穿时控制主次');
  }

  if (accentCount >= 3) {
    score -= 14;
    notes.push('亮色偏多，建议增加中性色过渡');
  }

  return { score: clamp(score, 38, 96), notes };
}

function styleConsistency(items, context) {
  const styles = items.map(item => item.style).filter(Boolean);
  if (styles.length === 0) return { score: 58, notes: ['风格信息不足'] };

  const styleText = styles.join(',');
  let score = 64;
  const notes = [];

  if (context.occasionStyles.some(style => styleText.includes(style))) {
    score += 14;
    notes.push(`风格贴合${context.occasion}`);
  }

  const families = new Set(styles.map(style => {
    if (hasAny(style, ['正式', '商务'])) return 'formal';
    if (hasAny(style, ['运动'])) return 'sport';
    if (hasAny(style, ['休闲', '街头'])) return 'casual';
    if (hasAny(style, ['简约', '优雅'])) return 'clean';
    return style;
  }));

  if (families.size <= 2) {
    score += 8;
    notes.push('风格语言比较统一');
  }

  if (families.has('formal') && families.has('sport')) {
    score -= 16;
    notes.push('正式和运动风格混用，需要谨慎');
  }

  return { score: clamp(score, 38, 95), notes };
}

function rolePresence(items) {
  const roles = new Set(items.map(item => item.recommendation_attributes.layering_role));
  return {
    top: roles.has('top'),
    bottom: roles.has('bottom'),
    outer: roles.has('outer'),
    shoes: roles.has('shoes'),
    accessory: roles.has('accessory')
  };
}

function buildConstraintWarnings(items, context, template, hardWarnings) {
  const presence = rolePresence(items);
  const warnings = [...hardWarnings];

  if (!presence.top) warnings.push('缺少可搭配上衣，当前推荐只能作为单品参考');
  if (!presence.bottom) warnings.push('缺少下装，当前推荐不是完整搭配');
  if (!presence.shoes) warnings.push('缺少鞋子记录，不能判断脚下风格和天气适配');
  if (template.requiredRoles.includes('outer') && !presence.outer) {
    warnings.push('低温需要外套，但衣橱没有可用外套记录');
  }
  if (context.band === 'cool' && template.includeOuter && !presence.outer) {
    warnings.push('微凉天气建议准备轻外套，当前衣橱未提供外套备选');
  }
  if (context.weatherRisk.rain || context.weatherRisk.snow) {
    warnings.push('雨雪天气建议选择耐脏颜色和防滑鞋');
  }

  items.forEach(item => {
    const attrs = item.recommendation_attributes;
    if (context.band === 'hot' && attrs.warmth_level >= 4) {
      warnings.push(`${item.name} 在高温下可能偏厚`);
    }
    if (context.band === 'cold' && attrs.layering_role !== 'outer' && attrs.warmth_level <= 1.8) {
      warnings.push(`${item.name} 在低温下偏薄，需要叠穿`);
    }
    if ((context.weatherRisk.rain || context.weatherRisk.snow) && attrs.weather_risk.rain_light_color) {
      warnings.push(`${item.name} 雨雪天耐脏风险较高`);
    }
  });

  return [...new Set(warnings)];
}

function completenessScore(items, template) {
  const presence = rolePresence(items);
  const hit = template.requiredRoles.filter(role => presence[role]).length;
  return round((hit / template.requiredRoles.length) * 100);
}

function accuracyLevel(items, context, template) {
  const presence = rolePresence(items);
  const missingCore = !presence.top || !presence.bottom;
  const missingRequiredOuter = template.requiredRoles.includes('outer') && !presence.outer;

  if (missingCore || missingRequiredOuter) return 'insufficient_data';
  if (!presence.shoes) return 'usable_with_gap';
  return 'complete';
}

function accuracyLabel(level) {
  if (level === 'complete') return '完整实穿';
  if (level === 'usable_with_gap') return '可参考，缺关键品类';
  return '数据不足';
}

function comfortNotes(items, context, template) {
  const notes = [];
  if (context.band === 'hot') notes.push('当前按高温处理，优先透气轻薄且不加入外套');
  if (context.band === 'cool') notes.push('当前按微凉处理，外套作为可选层');
  if (context.band === 'cold') notes.push('当前按低温处理，外套为必需层');
  if (context.band === 'mild') notes.push('当前温度温和，优先完整基础搭配');

  const avgWarmth = items.length
    ? items.reduce((sum, item) => sum + item.recommendation_attributes.warmth_level, 0) / items.length
    : 0;
  const avgBreathability = items.length
    ? items.reduce((sum, item) => sum + item.recommendation_attributes.breathability_level, 0) / items.length
    : 0;

  if (context.band === 'hot' && avgBreathability >= 3.5) notes.push('候选单品整体透气度较好');
  if (context.band === 'cold' && avgWarmth >= 3.4) notes.push('候选单品整体保暖度较好');
  if (template.comfortGoal) notes.push(`本次模板目标：${template.comfortGoal}`);

  return [...new Set(notes)].slice(0, 4);
}

function weatherReason(context) {
  if (context.temperature === null) return context.weather.weather || '当前天气';
  return `${context.weather.weather || '当前天气'}，约 ${context.temperature}°C`;
}

function normalizeComponentScore(value, base = 60, multiplier = 8) {
  return clamp(round(base + value * multiplier), 15, 100);
}

function buildOutfit(combo, context, template, profile, hardWarnings) {
  const rankedItems = combo.rankedItems.filter(Boolean).filter((candidate, index, arr) => {
    return arr.findIndex(other => other.item.id === candidate.item.id) === index;
  });
  const items = rankedItems.map(candidate => candidate.item);
  const color = colorHarmony(items, profile);
  const style = styleConsistency(items, context);
  const completeness = completenessScore(items, template);
  const constraints = buildConstraintWarnings(
    items,
    context,
    template,
    [...hardWarnings, ...rankedItems.flatMap(candidate => candidate.hard_warnings)]
  );
  const comfort = comfortNotes(items, context, template);
  const level = accuracyLevel(items, context, template);
  const weatherPoints = rankedItems.reduce((sum, candidate) => sum + candidate.breakdown.weather, 0);
  const comfortPoints = rankedItems.reduce((sum, candidate) => sum + candidate.breakdown.comfort, 0);
  const occasionPoints = rankedItems.reduce((sum, candidate) => sum + candidate.breakdown.occasion, 0);
  const preferencePoints = rankedItems.reduce((sum, candidate) => sum + candidate.breakdown.preference, 0);
  const hardPenalty = rankedItems.reduce((sum, candidate) => sum + candidate.hard_penalty, 0) + constraints.length * 1.5;
  const signature = items.map(item => String(item.id)).sort().join('|');
  const comboWeight = profile.comboWeights.get(signature) || 0;
  const denominator = Math.max(rankedItems.length, 1);

  const scoreBreakdown = {
    weather: normalizeComponentScore(weatherPoints / denominator, 60, 9),
    comfort: normalizeComponentScore(comfortPoints / denominator, 58, 8),
    occasion: normalizeComponentScore(occasionPoints / denominator, 56, 12),
    color: round(color.score),
    style: round(style.score),
    preference: clamp(round(60 + (preferencePoints + comboWeight) * 8), 20, 100),
    completeness
  };

  let score = round(
    scoreBreakdown.weather * 0.22 +
    scoreBreakdown.comfort * 0.2 +
    scoreBreakdown.occasion * 0.18 +
    scoreBreakdown.completeness * 0.16 +
    scoreBreakdown.color * 0.1 +
    scoreBreakdown.style * 0.09 +
    scoreBreakdown.preference * 0.05 -
    hardPenalty
  );

  if (level === 'usable_with_gap') score = Math.min(score, 78);
  if (level === 'insufficient_data') score = Math.min(score, 64);

  const styleNotes = [...new Set([...color.notes, ...style.notes])].slice(0, 4);
  const reasonParts = [
    `基于${weatherReason(context)}和${context.occasion}场景`,
    accuracyLabel(level),
    comfort[0],
    styleNotes[0]
  ].filter(Boolean);

  return {
    name: template.label,
    occasion: context.occasion,
    weather: context.weather,
    items,
    score: clamp(score, 1, 100),
    rule_score: clamp(score, 1, 100),
    hybrid_score: clamp(score, 1, 100),
    ai_review_status: 'not_requested',
    reason: reasonParts.join('；'),
    style_notes: styleNotes,
    missing_items: constraints.filter(item => /缺少|未提供|没有/.test(item)),
    constraint_warnings: constraints,
    comfort_notes: comfort,
    accuracy_level: level,
    score_breakdown: scoreBreakdown
  };
}

function nameOutfit(outfit, index, context, template) {
  if (index === 0) {
    return outfit.accuracy_level === 'complete' ? '今日实穿搭配' : '今日可参考搭配';
  }
  if (index === 1) return `${context.occasion}场景备选`;
  return `${template.label}备选`;
}

function buildWardrobeConstraintWarnings(clothes, context, template) {
  const roles = new Set(clothes.map(item => item.recommendation_attributes.layering_role));
  const warnings = [];
  if (!roles.has('top')) warnings.push('衣橱缺少上衣，推荐无法组成完整上半身');
  if (!roles.has('bottom')) warnings.push('衣橱缺少下装，推荐无法组成完整搭配');
  if (!roles.has('shoes')) warnings.push('衣橱缺少鞋子，所有推荐都会降级为不完整搭配');
  if (template.requiredRoles.includes('outer') && !roles.has('outer')) {
    warnings.push('当前低温需要外套，但衣橱缺少外套');
  }
  if (context.band === 'hot' && clothes.every(item => item.recommendation_attributes.breathability_level < 3)) {
    warnings.push('高温天气下可用的轻薄透气单品不足');
  }
  return warnings;
}

function countBy(items, predicate) {
  return items.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function pickPairIds(clothes, categories) {
  return clothes
    .filter(item => categories.includes(item.category))
    .slice(0, 3)
    .map(item => item.id);
}

function colorForOccasion(occasion, context) {
  if (occasion === '正式' || occasion === '通勤') return '黑色、灰色或藏青色';
  if (context.band === 'hot') return '白色、米色或浅蓝色';
  return '黑色、白色或米色';
}

function styleForOccasion(occasion) {
  if (occasion === '正式' || occasion === '通勤') return '简约/商务';
  if (occasion === '运动') return '运动/休闲';
  return '休闲/简约';
}

function makeGapSuggestion({
  type,
  priority,
  title,
  description,
  recommended_category,
  recommended_color,
  recommended_style,
  recommended_material,
  pair_with_item_ids
}) {
  return {
    type,
    priority,
    title,
    description,
    recommended_category,
    recommended_color,
    recommended_style,
    recommended_material,
    pair_with_item_ids: pair_with_item_ids || []
  };
}

function buildGapSuggestions(clothes, context, template) {
  const occasion = context.occasion || '休闲';
  const suggestions = [];
  const hasTop = clothes.some(item => item.category === CATEGORY.TOP);
  const hasBottom = clothes.some(item => item.category === CATEGORY.PANTS || item.category === CATEGORY.SKIRT);
  const hasShoes = clothes.some(item => item.category === CATEGORY.SHOES);
  const hasOuter = clothes.some(item => item.category === CATEGORY.OUTER);

  if (!hasTop) {
    suggestions.push(makeGapSuggestion({
      type: 'missing_top',
      priority: 'high',
      title: '缺少上衣记录',
      description: '推荐无法稳定生成上半身核心单品，先补一件常穿上衣会明显提升搭配质量。',
      recommended_category: CATEGORY.TOP,
      recommended_color: colorForOccasion(occasion, context),
      recommended_style: styleForOccasion(occasion),
      recommended_material: context.band === 'hot' ? '棉、亚麻或速干面料' : '棉、羊毛混纺或针织',
      pair_with_item_ids: pickPairIds(clothes, [CATEGORY.PANTS, CATEGORY.SKIRT, CATEGORY.OUTER])
    }));
  }

  if (!hasBottom) {
    suggestions.push(makeGapSuggestion({
      type: 'missing_bottom',
      priority: 'high',
      title: '缺少下装记录',
      description: '衣橱还没有裤子或裙子，推荐只能停留在单品层面，建议补一条高频基础下装。',
      recommended_category: CATEGORY.PANTS,
      recommended_color: '黑色、深蓝色或卡其色',
      recommended_style: styleForOccasion(occasion),
      recommended_material: context.band === 'hot' ? '棉、亚麻或薄牛仔' : '牛仔、斜纹布或羊毛混纺',
      pair_with_item_ids: pickPairIds(clothes, [CATEGORY.TOP, CATEGORY.OUTER])
    }));
  }

  if (!hasShoes) {
    suggestions.push(makeGapSuggestion({
      type: 'missing_shoes',
      priority: 'high',
      title: '缺少鞋子记录',
      description: '鞋子决定场景完成度和天气适配，建议先补一双最常穿、最百搭的鞋。',
      recommended_category: CATEGORY.SHOES,
      recommended_color: colorForOccasion(occasion, context),
      recommended_style: styleForOccasion(occasion),
      recommended_material: context.weatherRisk.rain || context.weatherRisk.snow ? '防滑、耐脏材质' : '皮革、帆布或织物',
      pair_with_item_ids: pickPairIds(clothes, [CATEGORY.TOP, CATEGORY.PANTS, CATEGORY.SKIRT])
    }));
  }

  if ((template.requiredRoles.includes('outer') || context.band === 'cool') && !hasOuter) {
    suggestions.push(makeGapSuggestion({
      type: 'missing_outerwear',
      priority: template.requiredRoles.includes('outer') ? 'high' : 'medium',
      title: template.requiredRoles.includes('outer') ? '当前天气缺少外套' : '可补一件轻外套',
      description: template.requiredRoles.includes('outer') ? '低温下外套是刚需，缺外套会让推荐完整度明显下降。' : '微凉天气下，轻外套能让搭配更稳妥。',
      recommended_category: CATEGORY.OUTER,
      recommended_color: '黑色、灰色、卡其色或藏青色',
      recommended_style: styleForOccasion(occasion),
      recommended_material: template.requiredRoles.includes('outer') ? '羽绒、羊毛、棉服或毛呢' : '风衣、牛仔、针织或轻薄防风面料',
      pair_with_item_ids: pickPairIds(clothes, [CATEGORY.TOP, CATEGORY.PANTS, CATEGORY.SKIRT])
    }));
  }

  const summerItems = countBy(clothes, item => {
    const attrs = item.recommendation_attributes || deriveItemAttributes(item);
    return hasSeason(item, '夏季') || attrs.breathability_level >= 4;
  });
  if (summerItems < 2) {
    suggestions.push(makeGapSuggestion({
      type: 'summer_coverage',
      priority: context.band === 'hot' ? 'high' : 'medium',
      title: '夏季覆盖不足',
      description: '高温天气需要更多轻薄、透气单品，否则推荐会偏厚或重复。',
      recommended_category: CATEGORY.TOP,
      recommended_color: '白色、米色、浅蓝色或浅灰色',
      recommended_style: '休闲/简约',
      recommended_material: '棉、亚麻、天丝或速干面料',
      pair_with_item_ids: pickPairIds(clothes, [CATEGORY.PANTS, CATEGORY.SKIRT])
    }));
  }

  const formalItems = countBy(clothes, item => {
    const attrs = item.recommendation_attributes || deriveItemAttributes(item);
    return includesValue(item.occasion, '通勤') || includesValue(item.occasion, '正式') || attrs.formality_level >= 3.5;
  });
  if ((occasion === '通勤' || occasion === '正式') && formalItems < 2) {
    suggestions.push(makeGapSuggestion({
      type: 'formal_coverage',
      priority: 'medium',
      title: '通勤/正式场景不足',
      description: '当前衣橱里通勤或正式属性单品偏少，容易让推荐显得不够稳重。',
      recommended_category: CATEGORY.TOP,
      recommended_color: '白色、浅蓝色、灰色或藏青色',
      recommended_style: '简约/商务',
      recommended_material: '挺括棉、羊毛混纺或垂感面料',
      pair_with_item_ids: pickPairIds(clothes, [CATEGORY.PANTS, CATEGORY.SKIRT, CATEGORY.OUTER])
    }));
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return suggestions
    .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9))
    .slice(0, 5);
}

function recommendOutfits(clothes, context = {}) {
  const recommendationContext = normalizeRecommendationContext(context);
  const maxOutfits = clamp(Number(context.maxOutfits) || 3, 1, 5);
  const safeClothes = enrichClothes(Array.isArray(clothes) ? clothes : []);
  const template = getWearTemplate(recommendationContext);
  const profile = buildPreferenceProfile(safeClothes, context.feedbackLogs || []);
  const rawPools = buildRawPools(safeClothes, recommendationContext, profile);
  const hardFiltered = applyHardFilters(rawPools, recommendationContext);
  const wardrobeWarnings = buildWardrobeConstraintWarnings(safeClothes, recommendationContext, template);
  const planned = generateCandidateOutfits(hardFiltered.pools, recommendationContext, template);
  const hardWarnings = [...new Set([...hardFiltered.warnings, ...wardrobeWarnings])];
  const outfits = planned
    .map(plan => buildOutfit(plan, recommendationContext, template, profile, hardWarnings))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxOutfits)
    .map((outfit, index) => ({
      ...outfit,
      name: nameOutfit(outfit, index, recommendationContext, template)
    }));
  const gapSuggestions = buildGapSuggestions(safeClothes, recommendationContext, template);

  return {
    outfits,
    gaps: gapSuggestions.map(item => `${item.title}：${item.description}`),
    gap_suggestions: gapSuggestions,
    recommendation_context: {
      temperature_band: recommendationContext.band,
      template: template.key,
      hard_constraints: hardWarnings
    },
    preference_summary: {
      feedback_count: profile.totalSignals
    }
  };
}

module.exports = {
  recommendOutfits
};
