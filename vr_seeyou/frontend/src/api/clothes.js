import request from '@/utils/request'

// 上传衣物图片并识别（不保存入库）
export function recognizeCloth(file) {
  const formData = new FormData()
  formData.append('image', file)

  return request({
    url: '/api/clothes/recognize',
    method: 'post',
    data: formData
  })
}

// 确认保存衣物
export function createCloth(data) {
  return request({
    url: '/api/clothes',
    method: 'post',
    data
  })
}

// 旧接口：上传衣物图片并直接保存
export function uploadCloth(file) {
  const formData = new FormData()
  formData.append('image', file)

  return request({
    url: '/api/clothes/upload',
    method: 'post',
    data: formData
  })
}

// 获取所有衣物
export function getClothes(params = {}) {
  return request({
    url: '/api/clothes',
    method: 'get',
    params
  })
}

// 获取单件衣物
export function getClothById(id) {
  return request({
    url: `/api/clothes/${id}`,
    method: 'get'
  })
}

// 更新衣物
export function updateCloth(id, data) {
  return request({
    url: `/api/clothes/${id}`,
    method: 'put',
    data
  })
}

// 重新分析已有衣物图片，返回待确认的 AI 标签
export function reanalyzeCloth(id) {
  return request({
    url: `/api/clothes/${id}/reanalyze`,
    method: 'post'
  })
}

// 删除衣物
export function deleteCloth(id) {
  return request({
    url: `/api/clothes/${id}`,
    method: 'delete'
  })
}

// 切换收藏状态
export function toggleFavorite(id) {
  return request({
    url: `/api/clothes/${id}/favorite`,
    method: 'post'
  })
}

// 记录穿着
export function recordWear(id) {
  return request({
    url: `/api/clothes/${id}/wear`,
    method: 'post'
  })
}

// 获取单件衣物的穿着明细
export function getWearLogs(id, limit = 20) {
  return request({
    url: `/api/clothes/${id}/wear-logs`,
    method: 'get',
    params: { limit, _t: Date.now() }
  })
}

// 获取分类统计
export function getCategoryStats() {
  return request({
    url: '/api/stats/categories',
    method: 'get'
  })
}

// 获取衣橱基础分析
export function getWardrobeAnalysis() {
  return request({
    url: '/api/wardrobe/analysis',
    method: 'get',
    params: { _t: Date.now() }
  })
}

// 获取高德实况天气
export function getCurrentWeather(city) {
  return request({
    url: '/api/weather/current',
    method: 'get',
    params: { city, _t: Date.now() }
  })
}

// 使用高德 IP 定位当前城市
export function locateByIp() {
  return request({
    url: '/api/location/ip',
    method: 'get',
    params: { _t: Date.now() }
  })
}

// 根据浏览器经纬度反查高德城市编码
export function reverseGeocode(longitude, latitude) {
  return request({
    url: '/api/location/regeo',
    method: 'get',
    params: { longitude, latitude, _t: Date.now() }
  })
}

// 获取穿搭推荐
export function getOutfitRecommendations(params = {}) {
  return request({
    url: '/api/recommendations/outfits',
    method: 'get',
    params: { ...params, _t: Date.now() }
  })
}

// 记录搭配推荐反馈
export function submitRecommendationFeedback(data) {
  return request({
    url: '/api/recommendations/feedback',
    method: 'post',
    data
  })
}
