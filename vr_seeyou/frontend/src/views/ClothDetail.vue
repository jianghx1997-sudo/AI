<template>
  <div class="cloth-detail">
    <van-nav-bar
      title="衣物详情"
      left-arrow
      @click-left="$router.back()"
      fixed
      placeholder
    >
      <template #right>
        <span class="edit-link" @click="toggleEdit">
          {{ isEditing ? '取消' : '编辑' }}
        </span>
      </template>
    </van-nav-bar>

    <div class="detail-content" v-if="cloth">
      <!-- 大图展示 -->
      <div class="image-section">
        <img :src="cloth.image_path" :alt="cloth.name" />
        <div class="image-actions">
          <div
            class="icon-btn"
            :class="{ active: cloth.is_favorite }"
            @click="handleFavorite"
          >
            <van-icon :name="cloth.is_favorite ? 'like' : 'like-o'" size="20" />
          </div>
        </div>
      </div>

      <!-- 编辑模式 -->
      <div v-if="isEditing" class="edit-card surface-card">
        <van-field v-model="editForm.name" label="名称" placeholder="请输入名称" />
        <van-field label="类别">
          <template #input>
            <select v-model="editForm.category" class="custom-select">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </template>
        </van-field>
        <van-field label="颜色">
          <template #input>
            <select v-model="editForm.color" class="custom-select">
              <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
            </select>
          </template>
        </van-field>
        <van-field label="季节">
          <template #input>
            <select v-model="editForm.season" class="custom-select">
              <option v-for="s in seasons" :key="s" :value="s">{{ s }}</option>
            </select>
          </template>
        </van-field>
        <van-field label="场合">
          <template #input>
            <select v-model="editForm.occasion" class="custom-select">
              <option v-for="o in occasions" :key="o" :value="o">{{ o }}</option>
            </select>
          </template>
        </van-field>
        <van-field label="版型">
          <template #input>
            <select v-model="editForm.fit" class="custom-select">
              <option v-for="f in fits" :key="f" :value="f">{{ f }}</option>
            </select>
          </template>
        </van-field>
        <van-field v-model="editForm.material" label="材质" placeholder="如：棉、羊毛" />
        <van-field v-model="editForm.style" label="风格" placeholder="如：休闲、商务" />
        <van-field v-model="editForm.brand" label="品牌" placeholder="可选" />
        <van-field v-model="editForm.tags" label="标签" placeholder="逗号分隔，如：保暖,通勤" />
        <van-field v-model="editForm.purchase_date" label="购买日期" type="date" />

        <div style="padding: 16px">
          <van-button type="primary" round block @click="saveEdit">保存修改</van-button>
        </div>
      </div>

      <!-- 展示模式 -->
      <div v-else class="info-card surface-card">
        <h2 class="cloth-title">{{ cloth.name }}</h2>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">类别</span>
            <van-tag type="primary" size="medium">{{ cloth.category }}</van-tag>
          </div>
          <div class="info-item">
            <span class="info-label">颜色</span>
            <van-tag type="success" size="medium">{{ cloth.color }}</van-tag>
          </div>
          <div class="info-item">
            <span class="info-label">季节</span>
            <van-tag type="warning" size="medium">{{ cloth.season }}</van-tag>
          </div>
          <div class="info-item">
            <span class="info-label">场合</span>
            <van-tag type="primary" plain size="medium">{{ cloth.occasion }}</van-tag>
          </div>
          <div class="info-item">
            <span class="info-label">版型</span>
            <span class="info-value">{{ cloth.fit }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">材质</span>
            <span class="info-value">{{ cloth.material }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">风格</span>
            <span class="info-value">{{ cloth.style }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">品牌</span>
            <span class="info-value">{{ cloth.brand || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">置信度</span>
            <span class="info-value">{{ cloth.confidence ? (cloth.confidence * 100).toFixed(1) + '%' : '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">识别来源</span>
            <span class="info-value">{{ sourceLabel(cloth.source) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">穿着次数</span>
            <span class="info-value">{{ cloth.wear_count || 0 }} 次</span>
          </div>
        </div>

        <div class="tags-section" v-if="cloth.tags">
          <span class="section-label">标签</span>
          <div class="tags-list">
            <van-tag
              v-for="tag in cloth.tags.split(',')"
              :key="tag"
              plain
              round
              size="small"
              class="tag-chip"
            >
              {{ tag }}
            </van-tag>
          </div>
        </div>

        <div class="time-section">
          <div class="time-row">
            <span class="time-label">添加时间</span>
            <span class="time-value">{{ formatDate(cloth.created_at) }}</span>
          </div>
          <div class="time-row" v-if="cloth.last_worn">
            <span class="time-label">最近穿着</span>
            <span class="time-value">{{ formatDate(cloth.last_worn) }}</span>
          </div>
          <div class="time-row" v-if="cloth.purchase_date">
            <span class="time-label">购买日期</span>
            <span class="time-value">{{ cloth.purchase_date }}</span>
          </div>
        </div>

        <div class="wear-history" v-if="wearLogs.length > 0">
          <span class="section-label">最近穿着记录</span>
          <div class="wear-log" v-for="log in wearLogs.slice(0, 5)" :key="log.id">
            <span>{{ formatDate(log.worn_at) }}</span>
            <span v-if="log.occasion">{{ log.occasion }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons" v-if="!isEditing">
        <van-button
          type="primary"
          round
          block
          plain
          hairline
          icon="passed"
          class="subtle-button wear-button"
          @click="handleWear"
        >
          记录今天穿了这件
        </van-button>
        <van-button
          type="danger"
          round
          block
          plain
          hairline
          icon="delete-o"
          @click="showDeleteConfirm = true"
        >
          删除这件衣物
        </van-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <van-loading v-if="loading" class="loading" type="spinner" color="#1989fa" />

    <!-- 删除确认 -->
    <van-dialog
      v-model:show="showDeleteConfirm"
      title="确认删除"
      show-cancel-button
      @confirm="handleDelete"
    >
      <p style="padding: 20px; text-align: center; color: #666;">
        确定要删除「{{ cloth?.name }}」吗？<br/>此操作不可恢复
      </p>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { getClothById, getWearLogs, updateCloth, deleteCloth, toggleFavorite, recordWear } from '@/api/clothes'

const route = useRoute()
const router = useRouter()
const cloth = ref(null)
const loading = ref(true)
const showDeleteConfirm = ref(false)
const isEditing = ref(false)
const wearLogs = ref([])

const categories = ['上衣', '裤子', '裙子', '外套', '鞋子', '配饰']
const colors = ['黑色', '白色', '灰色', '蓝色', '红色', '绿色', '黄色', '粉色', '米色', '棕色', '紫色', '橙色', '未知']
const seasons = ['春/秋', '夏季', '冬季', '四季']
const occasions = ['通勤', '约会', '运动', '休闲', '正式', '旅行']
const fits = ['修身', '宽松', '标准']

const editForm = ref({})

const fetchCloth = async () => {
  try {
    const res = await getClothById(route.params.id)
    if (res.success) {
      cloth.value = res.data
    } else {
      showToast('衣物不存在')
      router.back()
    }
  } catch (error) {
    showToast(error.message || '获取失败')
    router.back()
  } finally {
    loading.value = false
  }
}

const fetchWearLogs = async () => {
  try {
    const res = await getWearLogs(route.params.id, 10)
    if (res.success) {
      wearLogs.value = res.data || []
    }
  } catch (error) {
    console.warn('获取穿着记录失败:', error)
  }
}

const toggleEdit = () => {
  if (isEditing.value) {
    isEditing.value = false
    return
  }
  editForm.value = {
    name: cloth.value.name,
    category: cloth.value.category,
    color: cloth.value.color,
    season: cloth.value.season,
    material: cloth.value.material,
    style: cloth.value.style,
    occasion: cloth.value.occasion || '休闲',
    fit: cloth.value.fit || '标准',
    brand: cloth.value.brand || '',
    tags: cloth.value.tags || '',
    purchase_date: cloth.value.purchase_date || ''
  }
  isEditing.value = true
}

const saveEdit = async () => {
  try {
    const res = await updateCloth(route.params.id, editForm.value)
    if (res.success) {
      showSuccessToast('保存成功')
      isEditing.value = false
      await fetchCloth()
    }
  } catch (error) {
    showToast(error.message || '保存失败')
  }
}

const handleFavorite = async () => {
  try {
    const res = await toggleFavorite(route.params.id)
    if (res.success) {
      cloth.value.is_favorite = res.data.is_favorite
      showToast(cloth.value.is_favorite ? '已收藏' : '已取消收藏')
    }
  } catch (error) {
    showToast(error.message || '操作失败')
  }
}

const handleWear = async () => {
  try {
    const res = await recordWear(route.params.id)
    if (res.success) {
      cloth.value.wear_count = res.data.wear_count
      cloth.value.last_worn = res.data.last_worn
      await fetchWearLogs()
      showSuccessToast('已记录穿着')
    }
  } catch (error) {
    showToast(error.message || '记录失败')
  }
}

const handleDelete = async () => {
  try {
    const res = await deleteCloth(route.params.id)
    if (res.success) {
      showSuccessToast('删除成功')
      router.push('/wardrobe')
    }
  } catch (error) {
    showToast(error.message || '删除失败')
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const sourceLabel = (source) => {
  if (source === 'volcano_ark') return 'Doubao 视觉识别'
  if (source === 'local_heuristic' || source === 'mock') return 'Mock 模拟识别'
  if (source === 'manual') return '手动录入'
  return source || '-'
}

onMounted(() => {
  fetchCloth()
  fetchWearLogs()
})
</script>

<style scoped>
.detail-content {
  min-height: 100vh;
  padding: 16px 16px 92px;
  background: var(--sw-bg);
}

.edit-link {
  color: var(--sw-primary);
  font-size: 14px;
  font-weight: 650;
}

.image-section {
  width: 100%;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius);
  background: var(--sw-surface-soft);
  margin-bottom: 14px;
}

.image-section img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  display: block;
}

.image-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--sw-border);
  color: var(--sw-text-muted);
}

.icon-btn.active {
  color: var(--sw-accent);
}

.info-card {
  padding: 18px;
}

.edit-card {
  overflow: hidden;
  padding: 12px 0;
}

.custom-select {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--sw-text);
  outline: none;
  text-align: right;
}

.cloth-title {
  font-size: 21px;
  font-weight: 700;
  color: var(--sw-text);
  margin-bottom: 18px;
  text-align: center;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label {
  font-size: 12px;
  color: var(--sw-text-muted);
}

.info-value {
  font-size: 15px;
  color: var(--sw-text);
  font-weight: 600;
}

.tags-section {
  margin-bottom: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--sw-border);
}

.section-label {
  font-size: 12px;
  color: var(--sw-text-muted);
  display: block;
  margin-bottom: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
}

.tag-chip {
  margin: 4px;
}

.time-section {
  padding-top: 16px;
  border-top: 1px solid var(--sw-border);
}

.time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.time-row:last-child {
  margin-bottom: 0;
}

.time-label {
  font-size: 12px;
  color: var(--sw-text-muted);
}

.time-value {
  font-size: 13px;
  color: var(--sw-text-muted);
}

.wear-history {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--sw-border);
}

.wear-log {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--sw-text);
  padding: 8px 0;
  border-bottom: 1px solid var(--sw-border);
}

.wear-log:last-child {
  border-bottom: none;
}

.action-buttons {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.wear-button {
  margin-bottom: 0;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 100px 20px;
}
</style>
