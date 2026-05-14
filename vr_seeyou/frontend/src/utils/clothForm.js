export const categories = ['上衣', '裤子', '裙子', '外套', '鞋子', '配饰']
export const seasons = ['春/秋', '夏季', '冬季', '四季']
export const occasions = ['通勤', '约会', '运动', '休闲', '正式', '旅行']
export const fits = ['修身', '宽松', '标准']
export const styles = ['休闲', '商务', '运动', '正式', '街头', '简约', '优雅']

export const layeringRoles = [
  { label: '自动判断', value: '' },
  { label: '上衣/内搭', value: 'top' },
  { label: '下装', value: 'bottom' },
  { label: '外套', value: 'outer' },
  { label: '鞋子', value: 'shoes' },
  { label: '配饰', value: 'accessory' }
]

export const colorFamilies = [
  { label: '自动判断', value: '' },
  { label: '中性色', value: 'neutral' },
  { label: '冷色系', value: 'cool' },
  { label: '暖色系', value: 'warm' },
  { label: '亮点色', value: 'accent' },
  { label: '未知', value: 'unknown' }
]

export const emptyClothForm = () => ({
  name: '',
  category: '上衣',
  color: '',
  season: '四季',
  material: '',
  style: '休闲',
  occasion: '休闲',
  fit: '标准',
  warmth_level: 3,
  breathability_level: 3,
  formality_level: 2.5,
  layering_role: '',
  color_family: '',
  weather_risk: '',
  tags: '',
  confidence: 0,
  source: 'manual'
})

export const normalizeSeason = (value) => {
  if (value === '春秋') return '春/秋'
  return seasons.includes(value) ? value : '四季'
}

const pickOption = (options, value, fallback) => {
  return options.includes(value) ? value : fallback
}

const pickOptionValue = (options, value, fallback) => {
  return options.some(item => item.value === value) ? value : fallback
}

export const createClothFormFromRecognition = (result) => {
  const fallback = emptyClothForm()
  return {
    name: result?.name || fallback.name,
    category: result?.category || fallback.category,
    color: result?.color || fallback.color,
    season: normalizeSeason(result?.season || fallback.season),
    material: result?.material || fallback.material,
    style: pickOption(styles, result?.style, fallback.style),
    occasion: pickOption(occasions, result?.occasion, fallback.occasion),
    fit: pickOption(fits, result?.fit, fallback.fit),
    warmth_level: Number(result?.warmth_level || fallback.warmth_level),
    breathability_level: Number(result?.breathability_level || fallback.breathability_level),
    formality_level: Number(result?.formality_level || fallback.formality_level),
    layering_role: pickOptionValue(layeringRoles, result?.layering_role, fallback.layering_role),
    color_family: pickOptionValue(colorFamilies, result?.color_family, fallback.color_family),
    weather_risk: result?.weather_risk || fallback.weather_risk,
    tags: result?.tags || fallback.tags,
    confidence: Number(result?.confidence || 0),
    source: result?.raw?.source || result?.source || fallback.source
  }
}

export const createClothEditForm = (cloth = {}) => ({
  name: cloth.name || '',
  category: cloth.category || '上衣',
  color: cloth.color || '',
  season: normalizeSeason(cloth.season),
  material: cloth.material || '',
  style: cloth.style || '休闲',
  occasion: cloth.occasion || '休闲',
  fit: cloth.fit || '标准',
  brand: cloth.brand || '',
  tags: cloth.tags || '',
  warmth_level: Number(cloth.warmth_level || 3),
  breathability_level: Number(cloth.breathability_level || 3),
  formality_level: Number(cloth.formality_level || 2.5),
  layering_role: cloth.layering_role || '',
  color_family: cloth.color_family || '',
  weather_risk: cloth.weather_risk || '',
  purchase_date: cloth.purchase_date || ''
})

export const mergeAiDraftIntoForm = (current = {}, draft = {}) => ({
  ...current,
  name: draft.name || current.name,
  category: draft.category || current.category,
  color: draft.color || current.color,
  season: normalizeSeason(draft.season || current.season),
  material: draft.material || current.material,
  style: styles.includes(draft.style) ? draft.style : current.style,
  occasion: draft.occasion || current.occasion,
  fit: fits.includes(draft.fit) ? draft.fit : current.fit,
  tags: draft.tags || current.tags,
  warmth_level: Number(draft.warmth_level || current.warmth_level || 3),
  breathability_level: Number(draft.breathability_level || current.breathability_level || 3),
  formality_level: Number(draft.formality_level || current.formality_level || 2.5),
  layering_role: pickOptionValue(layeringRoles, draft.layering_role, current.layering_role),
  color_family: pickOptionValue(colorFamilies, draft.color_family, current.color_family),
  weather_risk: draft.weather_risk || current.weather_risk
})

export const levelLabel = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${numeric}/5` : '-'
}

export const roleLabel = (value) => {
  return layeringRoles.find(item => item.value === value)?.label || '-'
}

export const colorFamilyLabel = (value) => {
  return colorFamilies.find(item => item.value === value)?.label || '-'
}

export const sourceLabel = (source) => {
  if (source === 'volcano_ark') return 'Doubao 视觉识别'
  if (source === 'local_heuristic' || source === 'mock') return 'Mock 模拟识别'
  if (source === 'manual') return '手动录入'
  return source || '-'
}
