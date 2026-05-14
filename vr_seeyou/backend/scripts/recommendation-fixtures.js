const assert = require('assert');
const { recommendOutfits } = require('../services/recommendationService');

function cloth(overrides) {
  return {
    id: overrides.id,
    name: overrides.name || `衣物${overrides.id}`,
    image_path: `/uploads/fixture-${overrides.id}.jpg`,
    category: '上衣',
    color: '白色',
    season: '四季',
    style: '休闲',
    occasion: '休闲',
    material: '棉',
    fit: '标准',
    warmth_level: 2.5,
    breathability_level: 3,
    formality_level: 2.5,
    wear_count: 0,
    ...overrides
  };
}

const wardrobe = [
  cloth({ id: 1, name: '白色T恤', category: '上衣', color: '白色', season: '夏季', material: '棉', warmth_level: 1.4, breathability_level: 4.6, layering_role: 'top' }),
  cloth({ id: 2, name: '浅蓝衬衫', category: '上衣', color: '浅蓝色', season: '春/秋', style: '商务', occasion: '通勤', material: '棉', warmth_level: 2.1, breathability_level: 3.8, formality_level: 3.8, layering_role: 'top' }),
  cloth({ id: 3, name: '运动速干上衣', category: '上衣', color: '绿色', season: '夏季', style: '运动', occasion: '运动', material: '速干', warmth_level: 1.2, breathability_level: 5, formality_level: 1.3, layering_role: 'top' }),
  cloth({ id: 4, name: '红色针织衫', category: '上衣', color: '红色', season: '春/秋', style: '优雅', occasion: '约会', material: '针织', warmth_level: 3, breathability_level: 2.5, formality_level: 2.8, layering_role: 'top' }),
  cloth({ id: 5, name: '蓝色牛仔裤', category: '裤子', color: '蓝色', season: '四季', style: '休闲', material: '牛仔布', warmth_level: 2.5, breathability_level: 3, layering_role: 'bottom' }),
  cloth({ id: 6, name: '灰色西裤', category: '裤子', color: '灰色', season: '四季', style: '商务', occasion: '通勤', material: '涤纶', warmth_level: 2.5, breathability_level: 3, formality_level: 4, layering_role: 'bottom' }),
  cloth({ id: 7, name: '米色短裤', category: '裤子', color: '米色', season: '夏季', style: '休闲', occasion: '旅行', material: '棉麻', warmth_level: 1.2, breathability_level: 4.7, layering_role: 'bottom' }),
  cloth({ id: 8, name: '碎花半裙', category: '裙子', color: '彩色', season: '夏季', style: '优雅', occasion: '约会', material: '雪纺', warmth_level: 1.4, breathability_level: 4.2, formality_level: 2.8, layering_role: 'bottom' }),
  cloth({ id: 9, name: '黑色厚外套', category: '外套', color: '黑色', season: '冬季', style: '简约', material: '羊毛', warmth_level: 5, breathability_level: 1, formality_level: 3, layering_role: 'outer' }),
  cloth({ id: 10, name: '藏青西装外套', category: '外套', color: '藏青色', season: '春/秋', style: '商务', occasion: '通勤', material: '羊毛混纺', warmth_level: 3.5, breathability_level: 2.3, formality_level: 4.3, layering_role: 'outer' }),
  cloth({ id: 11, name: '轻薄防晒外套', category: '外套', color: '浅灰色', season: '夏季', style: '休闲', occasion: '旅行', material: '轻薄防晒', warmth_level: 1.5, breathability_level: 4, formality_level: 1.8, layering_role: 'outer', weather_risk: '雨天易脏' }),
  cloth({ id: 12, name: '白色跑鞋', category: '鞋子', color: '白色', season: '四季', style: '运动', material: '织物', warmth_level: 2, breathability_level: 4, layering_role: 'shoes' }),
  cloth({ id: 13, name: '黑色皮鞋', category: '鞋子', color: '黑色', season: '四季', style: '商务', occasion: '通勤', material: '皮革', warmth_level: 2.8, breathability_level: 2, formality_level: 4.2, layering_role: 'shoes' }),
  cloth({ id: 14, name: '米色围巾', category: '配饰', color: '米色', season: '冬季', style: '简约', material: '羊毛', warmth_level: 3.5, breathability_level: 1.5, layering_role: 'accessory' })
];

const casualOnly = wardrobe.filter(item => !['商务', '正式'].includes(item.style) && item.formality_level < 3.5);
const heavyOnly = [
  cloth({ id: 101, name: '厚毛衣', category: '上衣', season: '冬季', material: '羊毛', warmth_level: 4.5, breathability_level: 1.5, layering_role: 'top' }),
  cloth({ id: 102, name: '厚牛仔裤', category: '裤子', season: '冬季', material: '厚牛仔布', warmth_level: 4, breathability_level: 2, layering_role: 'bottom' }),
  cloth({ id: 103, name: '厚靴子', category: '鞋子', season: '冬季', material: '皮革', warmth_level: 4, breathability_level: 1.8, layering_role: 'shoes' }),
  cloth({ id: 104, name: '厚外套', category: '外套', season: '冬季', material: '羽绒', warmth_level: 5, breathability_level: 1, layering_role: 'outer' })
];

function run(context, items = wardrobe) {
  return recommendOutfits(items, { maxOutfits: 3, ...context });
}

function topOutfit(result) {
  assert(result.outfits.length > 0, 'expected at least one outfit');
  return result.outfits[0];
}

function hasCategory(outfit, category) {
  return outfit.items.some(item => item.category === category);
}

function hasItem(outfit, predicate) {
  return outfit.items.some(predicate);
}

function hasGap(result, type) {
  return result.gap_suggestions.some(gap => gap.type === type);
}

function allOutfits(result, predicate) {
  assert(result.outfits.length > 0, 'expected at least one outfit');
  assert(result.outfits.every(predicate));
}

function noDuplicateItems(result) {
  result.outfits.forEach(outfit => {
    const ids = outfit.items.map(item => item.id);
    assert.strictEqual(new Set(ids).size, ids.length, `${outfit.name} should not include duplicate items`);
  });
}

const cases = [
  {
    name: 'hot weather excludes outerwear',
    context: { weather: { weather: '晴', temperature: 32 }, occasion: '休闲' },
    assert: result => allOutfits(result, outfit => !hasCategory(outfit, '外套'))
  },
  {
    name: 'hot weather filters very warm non-shoe items',
    context: { weather: { weather: '晴', temperature: 34 }, occasion: '休闲' },
    assert: result => allOutfits(result, outfit => outfit.items.every(item => {
      const role = item.recommendation_attributes.layering_role;
      return role === 'shoes' || item.recommendation_attributes.warmth_level < 4.3;
    }))
  },
  {
    name: 'cold weather includes outerwear when available',
    context: { weather: { weather: '晴', temperature: 4 }, occasion: '休闲' },
    assert: result => assert(hasCategory(topOutfit(result), '外套'))
  },
  {
    name: 'cold weather uses cold template',
    context: { weather: { weather: '晴', temperature: 4 }, occasion: '休闲' },
    assert: result => assert.strictEqual(result.recommendation_context.template, 'cold_layered')
  },
  {
    name: 'mild weather can produce complete outfit',
    context: { weather: { weather: '晴', temperature: 22 }, occasion: '休闲' },
    assert: result => assert(result.outfits.some(outfit => outfit.accuracy_level === 'complete'))
  },
  {
    name: 'commute prefers formal pieces',
    context: { weather: { weather: '晴', temperature: 18 }, occasion: '通勤' },
    assert: result => assert(hasItem(topOutfit(result), item => item.style === '商务' || item.recommendation_attributes.formality_level >= 3.5))
  },
  {
    name: 'sport prefers sport pieces',
    context: { weather: { weather: '晴', temperature: 24 }, occasion: '运动' },
    assert: result => assert(hasItem(topOutfit(result), item => item.style === '运动' || String(item.occasion || '').includes('运动')))
  },
  {
    name: 'date scene can use elegant pieces',
    context: { weather: { weather: '晴', temperature: 24 }, occasion: '约会' },
    assert: result => assert(result.outfits.some(outfit => hasItem(outfit, item => item.style === '优雅' || item.category === '裙子')))
  },
  {
    name: 'missing shoes emits gap',
    context: { weather: { weather: '晴', temperature: 22 }, occasion: '休闲' },
    items: wardrobe.filter(item => item.category !== '鞋子'),
    assert: result => assert(hasGap(result, 'missing_shoes'))
  },
  {
    name: 'missing bottom emits gap',
    context: { weather: { weather: '晴', temperature: 22 }, occasion: '休闲' },
    items: wardrobe.filter(item => item.category !== '裤子' && item.category !== '裙子'),
    assert: result => assert(hasGap(result, 'missing_bottom'))
  },
  {
    name: 'missing top emits gap',
    context: { weather: { weather: '晴', temperature: 22 }, occasion: '休闲' },
    items: wardrobe.filter(item => item.category !== '上衣'),
    assert: result => assert(hasGap(result, 'missing_top'))
  },
  {
    name: 'cold without outerwear emits outerwear gap',
    context: { weather: { weather: '晴', temperature: 6 }, occasion: '休闲' },
    items: wardrobe.filter(item => item.category !== '外套'),
    assert: result => assert(hasGap(result, 'missing_outerwear'))
  },
  {
    name: 'hot sparse summer wardrobe emits summer coverage gap',
    context: { weather: { weather: '晴', temperature: 33 }, occasion: '休闲' },
    items: heavyOnly,
    assert: result => assert(hasGap(result, 'summer_coverage'))
  },
  {
    name: 'formal sparse wardrobe emits formal coverage gap',
    context: { weather: { weather: '晴', temperature: 20 }, occasion: '通勤' },
    items: casualOnly,
    assert: result => assert(hasGap(result, 'formal_coverage'))
  },
  {
    name: 'maxOutfits one limits result',
    context: { weather: { weather: '晴', temperature: 22 }, occasion: '休闲', maxOutfits: 1 },
    assert: result => assert.strictEqual(result.outfits.length, 1)
  },
  {
    name: 'maxOutfits caps at five',
    context: { weather: { weather: '晴', temperature: 22 }, occasion: '休闲', maxOutfits: 20 },
    assert: result => assert(result.outfits.length <= 5)
  },
  {
    name: 'empty wardrobe returns gap suggestions',
    context: { weather: { weather: '晴', temperature: 22 }, occasion: '休闲' },
    items: [],
    assert: result => {
      assert.strictEqual(result.outfits.length, 0);
      assert(hasGap(result, 'missing_top'));
      assert(hasGap(result, 'missing_bottom'));
      assert(hasGap(result, 'missing_shoes'));
    }
  },
  {
    name: 'feedback count is surfaced',
    context: {
      weather: { weather: '晴', temperature: 22 },
      occasion: '休闲',
      feedbackLogs: [{ item_ids: JSON.stringify([1, 5, 12]), feedback: 'liked' }]
    },
    assert: result => assert.strictEqual(result.preference_summary.feedback_count, 1)
  },
  {
    name: 'cold weather filters very thin non-outer items',
    context: { weather: { weather: '晴', temperature: 2 }, occasion: '休闲' },
    assert: result => allOutfits(result, outfit => outfit.items.every(item => {
      const role = item.recommendation_attributes.layering_role;
      return role === 'outer' || item.recommendation_attributes.warmth_level > 1.8;
    }))
  },
  {
    name: 'outfits do not duplicate items',
    context: { weather: { weather: '晴', temperature: 18 }, occasion: '休闲' },
    assert: noDuplicateItems
  }
];

cases.forEach(testCase => {
  const result = run(testCase.context, testCase.items || wardrobe);
  try {
    testCase.assert(result);
  } catch (error) {
    error.message = `${testCase.name}: ${error.message}`;
    throw error;
  }
});

console.log(`recommendation fixtures passed (${cases.length} cases)`);
