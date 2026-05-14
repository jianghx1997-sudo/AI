const {
  CATEGORY,
  deriveItemAttributes,
  hasSeason,
  includesValue
} = require('./foundation');

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

module.exports = { buildGapSuggestions };
