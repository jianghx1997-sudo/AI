<template>
  <div class="upload">
    <van-nav-bar title="添加衣物" fixed placeholder />

    <div class="upload-content page-shell">
      <section class="upload-entry surface-card" v-if="!previewUrl && !uploading && !processingPhoto">
        <div class="entry-icon">
          <van-icon name="photograph" size="34" />
        </div>
        <h1>添加衣物</h1>
        <p>选择一张清晰的单品照片</p>

        <div class="entry-actions">
          <label class="entry-action primary">
            <van-icon name="photograph" size="22" />
            <span>拍照</span>
            <input
              ref="cameraInput"
              class="file-picker-input"
              type="file"
              accept="image/*"
              capture="environment"
              @change="handleFileChange"
            />
          </label>
          <label class="entry-action">
            <van-icon name="photo-o" size="22" />
            <span>从相册选择</span>
            <input
              ref="albumInput"
              class="file-picker-input"
              type="file"
              accept="image/*"
              @change="handleFileChange"
            />
          </label>
        </div>
      </section>

      <section class="preview-area" v-if="previewUrl && !uploading && !processingPhoto">
        <img :src="previewUrl" class="preview-image" alt="衣物照片" />

        <div class="notice-card surface-card" v-if="recognizeError">
          <div class="notice-title">识别失败，可手动录入</div>
          <div class="notice-text">{{ recognizeError }}</div>
        </div>

        <div class="edit-card surface-card" v-if="recognizedImage">
          <div class="result-header">
            <div>
              <div class="result-title">{{ recognizeResult ? '识别结果' : '手动录入' }}</div>
              <div class="result-subtitle">{{ sourceLabel }}</div>
            </div>
            <van-tag v-if="form.confidence" plain>
              {{ (Number(form.confidence) * 100).toFixed(0) }}%
            </van-tag>
          </div>

          <div class="field-block">
            <van-field v-model="form.name" label="名称" placeholder="例如：浅灰羽绒服" />
            <van-field label="类别">
              <template #input>
                <select v-model="form.category" class="custom-select">
                  <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
                </select>
              </template>
            </van-field>
            <van-field v-model="form.color" label="颜色" placeholder="例如：浅灰色" />
            <van-field label="季节">
              <template #input>
                <select v-model="form.season" class="custom-select">
                  <option v-for="item in seasons" :key="item" :value="item">{{ item }}</option>
                </select>
              </template>
            </van-field>
            <van-field label="场合">
              <template #input>
                <select v-model="form.occasion" class="custom-select">
                  <option v-for="item in occasions" :key="item" :value="item">{{ item }}</option>
                </select>
              </template>
            </van-field>
          </div>

          <button class="advanced-toggle" @click="showAdvanced = !showAdvanced">
            <span>更多信息</span>
            <van-icon :name="showAdvanced ? 'arrow-up' : 'arrow-down'" />
          </button>

          <div class="field-block advanced-fields" v-if="showAdvanced">
            <van-field v-model="form.material" label="材质" placeholder="例如：羽绒、棉、羊毛" />
            <van-field label="风格">
              <template #input>
                <select v-model="form.style" class="custom-select">
                  <option v-for="item in styles" :key="item" :value="item">{{ item }}</option>
                </select>
              </template>
            </van-field>
            <van-field label="版型">
              <template #input>
                <select v-model="form.fit" class="custom-select">
                  <option v-for="item in fits" :key="item" :value="item">{{ item }}</option>
                </select>
              </template>
            </van-field>
            <van-field label="叠穿角色">
              <template #input>
                <select v-model="form.layering_role" class="custom-select">
                  <option v-for="item in layeringRoles" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </template>
            </van-field>
            <van-field label="色系">
              <template #input>
                <select v-model="form.color_family" class="custom-select">
                  <option v-for="item in colorFamilies" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </template>
            </van-field>
            <div class="rating-fields">
              <label>
                <span>保暖度 {{ form.warmth_level }}/5</span>
                <input v-model.number="form.warmth_level" type="range" min="1" max="5" step="0.5" />
              </label>
              <label>
                <span>透气度 {{ form.breathability_level }}/5</span>
                <input v-model.number="form.breathability_level" type="range" min="1" max="5" step="0.5" />
              </label>
              <label>
                <span>正式度 {{ form.formality_level }}/5</span>
                <input v-model.number="form.formality_level" type="range" min="1" max="5" step="0.5" />
              </label>
            </div>
            <van-field v-model="form.weather_risk" label="天气风险" placeholder="例如：雨天易脏、高温偏厚" />
            <van-field v-model="form.tags" label="标签" placeholder="逗号分隔，如：保暖,通勤" />
          </div>

          <div class="result-actions">
            <van-button type="primary" round block :loading="saving" @click="confirmSave">
              保存到衣橱
            </van-button>
            <div class="secondary-actions">
              <van-button round plain hairline class="subtle-button" @click="retryRecognize">
                重新识别
              </van-button>
              <van-button round plain hairline class="subtle-button" @click="reset">
                重新选择
              </van-button>
            </div>
          </div>
        </div>

        <div class="upload-actions surface-card" v-else>
          <van-button type="primary" round block @click="startUpload">
            开始识别
          </van-button>
          <van-button round block plain hairline class="subtle-button" @click="prepareManualEntry">
            手动录入
          </van-button>
          <van-button round block plain hairline class="subtle-button" @click="reset">
            重新选择
          </van-button>
        </div>
      </section>

      <section class="uploading-area surface-card" v-if="uploading || processingPhoto">
        <van-loading type="spinner" color="#2f8f7b" size="36" />
        <p>{{ processingPhoto ? '正在处理照片' : '正在识别衣物' }}</p>
        <span>{{ processingPhoto ? '相机照片较大时会自动压缩' : '稍等片刻' }}</span>
      </section>
    </div>

    <van-dialog
      v-model:show="showSuccess"
      title="添加成功"
      show-cancel-button
      confirm-button-text="继续添加"
      cancel-button-text="去衣橱"
      @confirm="reset"
      @cancel="$router.push('/wardrobe')"
    >
      <div class="success-content">
        <p>已保存到衣橱</p>
        <p class="success-name">{{ form.name }}</p>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { showToast } from 'vant'
import { createCloth, recognizeCloth } from '@/api/clothes'
import {
  categories,
  seasons,
  occasions,
  fits,
  styles,
  layeringRoles,
  colorFamilies,
  emptyClothForm,
  createClothFormFromRecognition,
  sourceLabel as getSourceLabel
} from '@/utils/clothForm'

const cameraInput = ref(null)
const albumInput = ref(null)
const previewUrl = ref('')
const selectedFile = ref(null)
const uploading = ref(false)
const processingPhoto = ref(false)
const saving = ref(false)
const recognizeResult = ref(null)
const recognizedImage = ref(null)
const recognizeError = ref('')
const showSuccess = ref(false)
const showAdvanced = ref(false)

const MAX_UPLOAD_BYTES = 9 * 1024 * 1024
const HARD_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_EDGE = 1800
const SUPPORTED_UPLOAD_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

const form = ref(emptyClothForm())

const sourceLabel = computed(() => {
  if (!form.value.source) return '待确认'
  if (!['manual', 'volcano_ark', 'local_heuristic', 'mock'].includes(form.value.source)) {
    return `识别来源：${form.value.source}`
  }
  const label = getSourceLabel(form.value.source)
  return label === '-' ? '待确认' : label
})

const fillFormFromResult = (result) => {
  form.value = createClothFormFromRecognition(result)
}

const loadImageFromFile = (file) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('照片读取失败，请重试'))
    }
    image.src = url
  })
}

const canvasToBlob = (canvas, type, quality) => {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob(resolve, type, quality)
      return
    }

    const dataUrl = canvas.toDataURL(type, quality)
    const [header, payload] = dataUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] || type
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    resolve(new Blob([bytes], { type: mime }))
  })
}

const compressImageFile = async (file) => {
  const supportedType = SUPPORTED_UPLOAD_TYPES.includes(String(file.type || '').toLowerCase())
  if (supportedType && file.size <= MAX_UPLOAD_BYTES) {
    return file
  }

  showToast(file.size > MAX_UPLOAD_BYTES ? '照片较大，正在压缩' : '正在转换照片格式')
  const image = await loadImageFromFile(file)
  const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height))
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio))
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, width, height)

  const qualities = [0.82, 0.74, 0.66, 0.58]
  let bestBlob = null
  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (!blob) continue
    bestBlob = blob
    if (blob.size <= MAX_UPLOAD_BYTES) break
  }

  if (!bestBlob) {
    throw new Error('照片压缩失败，请从相册选择较小图片')
  }

  const filename = file.name?.replace(/\.[^.]+$/, '.jpg') || `camera-${Date.now()}.jpg`
  return new File([bestBlob], filename, {
    type: 'image/jpeg',
    lastModified: Date.now()
  })
}

const handleFileChange = async (event) => {
  const pickedFile = event.target.files[0]
  event.target.value = ''

  if (!pickedFile) {
    showToast('没有选择照片，请重试')
    return
  }

  if (pickedFile.size <= 0) {
    showToast('照片文件无效，请重试')
    return
  }

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(pickedFile)
  selectedFile.value = null
  recognizeResult.value = null
  recognizedImage.value = null
  recognizeError.value = ''
  showAdvanced.value = false
  form.value = emptyClothForm()
  processingPhoto.value = true
  showToast('已选择照片，正在处理')

  let file
  try {
    file = await compressImageFile(pickedFile)
  } catch (error) {
    recognizeError.value = error.message || '照片处理失败，请重试'
    showToast(recognizeError.value)
    processingPhoto.value = false
    return
  }

  if (!file) {
    recognizeError.value = '没有选择照片，请重试'
    showToast(recognizeError.value)
    processingPhoto.value = false
    return
  }

  if (file.size > HARD_UPLOAD_LIMIT_BYTES) {
    recognizeError.value = '照片仍超过10MB，请从相册选择较小图片'
    showToast(recognizeError.value)
    processingPhoto.value = false
    return
  }

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  processingPhoto.value = false
  showToast('照片处理完成，开始识别')

  setTimeout(() => {
    startUpload()
  }, 300)
}

const startUpload = async () => {
  if (!selectedFile.value) {
    showToast('请先选择图片')
    return
  }

  uploading.value = true
  recognizeError.value = ''

  try {
    const res = await recognizeCloth(selectedFile.value)
    recognizedImage.value = res.data || null

    if (res.success) {
      recognizeResult.value = res.ai_result
      fillFormFromResult(res.ai_result)
      showToast('识别成功，可编辑后保存')
    } else {
      recognizeResult.value = null
      recognizeError.value = res.error || '识别失败'
      fillFormFromResult(null)
      showToast('识别失败，请手动补充信息')
    }
  } catch (error) {
    recognizeResult.value = null
    recognizeError.value = error.message || '识别失败'
    fillFormFromResult(null)
    showToast('识别失败，请手动补充信息')
  } finally {
    uploading.value = false
  }
}

const prepareManualEntry = async () => {
  if (!selectedFile.value) return
  if (!recognizedImage.value?.image_path) {
    await startUpload()
  }
  if (!recognizedImage.value?.image_path) {
    showToast('图片暂存失败，请重新选择')
    return
  }
  recognizeResult.value = null
  fillFormFromResult(null)
}

const retryRecognize = () => {
  recognizeResult.value = null
  recognizedImage.value = null
  recognizeError.value = ''
  showAdvanced.value = false
  form.value = emptyClothForm()
  startUpload()
}

const confirmSave = async () => {
  if (!recognizedImage.value?.image_path) {
    showToast('缺少图片，请重新选择')
    return
  }
  if (!form.value.name.trim()) {
    showToast('请填写名称')
    return
  }

  saving.value = true
  try {
    const payload = {
      ...form.value,
      image_path: recognizedImage.value.image_path,
      confidence: Number(form.value.confidence || 0)
    }
    const res = await createCloth(payload)
    if (res.success) {
      showSuccess.value = true
      showToast('保存成功')
    } else {
      showToast(res.error || '保存失败')
    }
  } catch (error) {
    showToast(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const reset = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = ''
  selectedFile.value = null
  recognizeResult.value = null
  recognizedImage.value = null
  recognizeError.value = ''
  uploading.value = false
  processingPhoto.value = false
  saving.value = false
  showSuccess.value = false
  showAdvanced.value = false
  form.value = emptyClothForm()
  if (cameraInput.value) cameraInput.value.value = ''
  if (albumInput.value) albumInput.value.value = ''
}
</script>

<style scoped>
.upload-entry {
  padding: 24px 18px 18px;
  text-align: center;
}

.entry-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sw-primary);
  background: var(--sw-primary-soft);
}

.upload-entry h1 {
  font-size: 22px;
  line-height: 1.25;
  color: var(--sw-text);
  margin-bottom: 8px;
}

.upload-entry p {
  font-size: 13px;
  color: var(--sw-text-muted);
  margin-bottom: 22px;
}

.entry-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.entry-action {
  position: relative;
  min-width: 0;
  min-height: 88px;
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius);
  background: var(--sw-surface);
  color: var(--sw-text);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

.entry-action.primary {
  border-color: var(--sw-primary);
  background: var(--sw-primary-soft);
  color: var(--sw-primary);
}

.file-picker-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.preview-image {
  width: 100%;
  max-height: 320px;
  object-fit: cover;
  border-radius: var(--sw-radius);
  margin-bottom: 14px;
  border: 1px solid var(--sw-border);
}

.notice-card,
.edit-card,
.upload-actions,
.uploading-area {
  padding: 16px;
  margin-bottom: 14px;
}

.notice-card {
  background: var(--sw-accent-soft);
}

.notice-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--sw-accent);
  margin-bottom: 6px;
}

.notice-text {
  font-size: 13px;
  color: var(--sw-text-muted);
  line-height: 1.5;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.result-title {
  font-size: 18px;
  font-weight: 650;
  color: var(--sw-text);
}

.result-subtitle {
  font-size: 12px;
  color: var(--sw-text-muted);
  margin-top: 4px;
}

.field-block {
  overflow: hidden;
  border: 1px solid var(--sw-border);
  border-radius: var(--sw-radius);
}

.field-block :deep(.van-cell) {
  padding-left: 12px;
  padding-right: 12px;
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

.advanced-toggle {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--sw-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 650;
  padding: 14px 0;
}

.advanced-fields {
  margin-top: 0;
}

.rating-fields {
  display: grid;
  gap: 12px;
  padding: 14px 12px;
  border-top: 1px solid var(--sw-border);
}

.rating-fields label {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: var(--sw-text-muted);
}

.rating-fields span {
  display: flex;
  justify-content: space-between;
  color: var(--sw-text);
  font-weight: 650;
}

.rating-fields input {
  width: 100%;
  accent-color: var(--sw-primary);
}

.result-actions {
  margin-top: 16px;
}

.secondary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.upload-actions {
  display: grid;
  gap: 10px;
}

.uploading-area {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.uploading-area p {
  font-size: 16px;
  font-weight: 650;
  color: var(--sw-text);
  margin-top: 18px;
}

.uploading-area span {
  font-size: 13px;
  color: var(--sw-text-muted);
  margin-top: 6px;
}

.success-content {
  text-align: center;
  padding: 20px;
}

.success-content p {
  color: var(--sw-text-muted);
  font-size: 14px;
}

.success-name {
  font-size: 18px !important;
  font-weight: 650;
  color: var(--sw-primary) !important;
  margin-top: 8px;
}
</style>
