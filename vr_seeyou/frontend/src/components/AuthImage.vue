<template>
  <img
    :src="currentSrc"
    :alt="alt"
    @error="handleNativeError"
  />
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
  } catch (error) {
    if (id === requestId) {
      currentSrc.value = props.fallback
    }
  }
}

function handleNativeError() {
  currentSrc.value = props.fallback
}

watch(sourceKey, loadImage, { immediate: true })

onBeforeUnmount(() => {
  requestId += 1
  revokeObjectUrl()
})
</script>
