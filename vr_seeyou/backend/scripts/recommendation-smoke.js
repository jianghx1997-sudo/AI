const assert = require('assert');
const { recommendOutfits } = require('../services/recommendationService');

function cloth(overrides) {
  return {
    id: overrides.id,
    name: overrides.name || `衣物${overrides.id}`,
    image_path: `/uploads/test-${overrides.id}.jpg`,
    category: '上衣',
    color: '白色',
    season: '四季',
    style: '休闲',
    occasion: '休闲',
    material: '棉',
    fit: '标准',
    wear_count: 0,
    ...overrides
  };
}

const base = [
  cloth({ id: 1, name: '白色T恤', category: '上衣', warmth_level: 1.5, breathability_level: 4.5, layering_role: 'top' }),
  cloth({ id: 2, name: '牛仔裤', category: '裤子', color: '蓝色', warmth_level: 2.5, breathability_level: 3, layering_role: 'bottom' }),
  cloth({ id: 3, name: '跑鞋', category: '鞋子', color: '白色', warmth_level: 2, breathability_level: 4, layering_role: 'shoes' }),
  cloth({ id: 4, name: '厚外套', category: '外套', color: '黑色', season: '冬季', warmth_level: 5, breathability_level: 1, layering_role: 'outer' })
];

const hot = recommendOutfits(base, {
  weather: { weather: '晴', temperature: 28 },
  occasion: '休闲',
  maxOutfits: 3
});

assert(hot.outfits.length > 0, '高温场景应生成至少一套推荐');
assert(
  hot.outfits.every(outfit => outfit.items.every(item => item.category !== '外套')),
  '28°C 高温不应推荐外套'
);

const coldNoOuter = recommendOutfits(base.filter(item => item.category !== '外套'), {
  weather: { weather: '晴', temperature: 8 },
  occasion: '休闲',
  maxOutfits: 3
});

assert(
  coldNoOuter.outfits.some(outfit => outfit.accuracy_level !== 'complete'),
  '低温缺外套时应降级为不完整推荐'
);
assert(
  coldNoOuter.outfits.some(outfit => (outfit.constraint_warnings || []).some(text => text.includes('外套'))),
  '低温缺外套时应给出外套提醒'
);

const noShoes = recommendOutfits(base.filter(item => item.category !== '鞋子'), {
  weather: { weather: '晴', temperature: 22 },
  occasion: '休闲',
  maxOutfits: 3
});

assert(
  noShoes.gap_suggestions.some(gap => gap.type === 'missing_shoes'),
  '缺鞋时应输出鞋子缺口建议'
);

console.log('recommendation smoke passed');
