<template>
  <img
    v-if="currentSrc"
    :src="currentSrc"
    :alt="alt"
    @error="handleNativeError"
  />
  <div v-else class="auth-image-placeholder" role="img" :aria-label="alt || '图片加载失败'">
    <span>{{ failed ? '图片加载失败' : '图片加载中' }}</span>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchAuthenticatedImageUrl } from '@/utils/images'

const props = defineProps({
  source: {
    type: [Object, String],
    default: null
  },
  version: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: ''
  },
  fallback: {
    type: String,
    default: ''
  }
})

const currentSrc = ref(props.fallback)
const failed = ref(false)
let objectUrl = ''
let requestId = 0

const sourceKey = computed(() => {
  const rawPath = typeof props.source === 'string' ? props.source : props.source?.image_path
  const version = props.version || props.source?.updated_at || props.source?.created_at || ''
  return `${rawPath || ''}|${version}`
})

function revokeObjectUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
}

async function loadImage() {
  const id = ++requestId
  revokeObjectUrl()
  failed.value = false
  currentSrc.value = props.fallback

  if (!props.source) return

  try {
    const nextUrl = await fetchAuthenticatedImageUrl(props.source, props.version)
    if (id !== requestId) {
      if (nextUrl) URL.revokeObjectURL(nextUrl)
      return
    }
    objectUrl = nextUrl
    currentSrc.value = nextUrl || props.fallback
    failed.value = !currentSrc.value
  } catch (error) {
    if (id === requestId) {
      failed.value = true
      currentSrc.value = props.fallback
    }
  }
}

function handleNativeError() {
  failed.value = true
  currentSrc.value = props.fallback
}

watch(sourceKey, loadImage, { immediate: true })

onBeforeUnmount(() => {
  requestId += 1
  revokeObjectUrl()
})
</script>

<style scoped>
.auth-image-placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: inherit;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef5f1, #f7faf8);
  color: #82918b;
  font-size: 13px;
  text-align: center;
}
</style>
