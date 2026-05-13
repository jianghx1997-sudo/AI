function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || '未标注';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function toSortedList(counts) {
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildCoverage(total, counts, expected) {
  return expected.map(name => ({
    name,
    count: counts[name] || 0,
    covered: Boolean(counts[name])
  }));
}

function buildInsights(clothes) {
  const insights = [];
  const categoryCounts = countBy(clothes, 'category');
  const seasonCounts = countBy(clothes, 'season');
  const occasionText = clothes.map(item => item.occasion || '').join(',');

  if (clothes.length === 0) {
    return ['衣橱还是空的，先录入 10-20 件常穿衣物，后续推荐才会更准。'];
  }

  if (!categoryCounts['裤子'] && !categoryCounts['裙子']) {
    insights.push('下装记录不足，后续穿搭推荐会缺少完整组合。');
  }
  if (!categoryCounts['鞋子']) {
    insights.push('鞋子记录不足，建议补录常穿鞋款，能提升整套搭配判断。');
  }
  if (!categoryCounts['外套']) {
    insights.push('外套记录不足，天气变冷时推荐会不够准确。');
  }
  if (!seasonCounts['冬季']) {
    insights.push('冬季衣物覆盖不足，建议补录保暖外套、毛衣或厚裤装。');
  }
  if (!seasonCounts['夏季']) {
    insights.push('夏季衣物覆盖不足，建议补录短袖、薄裤或裙装。');
  }
  if (!occasionText.includes('通勤') && !occasionText.includes('正式')) {
    insights.push('通勤/正式场景标注较少，后续可补充适合工作场合的衣物。');
  }

  return insights.slice(0, 5);
}

function analyzeWardrobe(clothes) {
  const total = clothes.length;
  const categories = ['上衣', '裤子', '裙子', '外套', '鞋子', '配饰'];
  const seasons = ['春/秋', '夏季', '冬季', '四季'];
  const occasions = ['通勤', '约会', '运动', '休闲', '正式', '旅行'];

  const categoryCounts = countBy(clothes, 'category');
  const seasonCounts = countBy(clothes, 'season');
  const colorCounts = countBy(clothes, 'color');
  const styleCounts = countBy(clothes, 'style');

  const occasionCounts = clothes.reduce((acc, item) => {
    String(item.occasion || '未标注')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .forEach(value => {
        acc[value] = (acc[value] || 0) + 1;
      });
    return acc;
  }, {});

  const favoriteCount = clothes.filter(item => item.is_favorite).length;
  const wornCount = clothes.filter(item => Number(item.wear_count || 0) > 0).length;
  const completenessFields = ['category', 'color', 'season', 'material', 'style', 'occasion', 'fit'];
  const completeness = total
    ? clothes.reduce((sum, item) => {
        const filled = completenessFields.filter(field => item[field]).length;
        return sum + filled / completenessFields.length;
      }, 0) / total
    : 0;

  return {
    total,
    favorite_count: favoriteCount,
    worn_count: wornCount,
    completeness: Number(completeness.toFixed(2)),
    category_distribution: toSortedList(categoryCounts),
    season_distribution: toSortedList(seasonCounts),
    color_distribution: toSortedList(colorCounts),
    style_distribution: toSortedList(styleCounts),
    category_coverage: buildCoverage(total, categoryCounts, categories),
    season_coverage: buildCoverage(total, seasonCounts, seasons),
    occasion_coverage: buildCoverage(total, occasionCounts, occasions),
    insights: buildInsights(clothes)
  };
}

module.exports = { analyzeWardrobe };
