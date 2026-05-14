const {
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
  enrichClothes,
  buildPreferenceProfile
} = require('./recommendation/foundation');
const { buildGapSuggestions } = require('./recommendation/gaps');

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
