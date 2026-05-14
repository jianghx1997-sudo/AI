import { useAuthStore } from '@/stores/auth'

export function getImageRequestUrl(itemOrPath, version = '') {
  const rawPath = typeof itemOrPath === 'string' ? itemOrPath : itemOrPath?.image_path
  if (!rawPath) return ''

  const relativePath = String(rawPath)
    .replace(/^\/uploads\//, '')
    .split('/')
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join('/')

  const params = new URLSearchParams()
  const cacheVersion = version || itemOrPath?.updated_at || itemOrPath?.created_at || Date.now()
  params.set('v', cacheVersion)

  return `/api/images/${relativePath}?${params.toString()}`
}

export async function fetchAuthenticatedImageUrl(itemOrPath, version = '') {
  const authStore = useAuthStore()
  const url = getImageRequestUrl(itemOrPath, version)
  if (!url) return ''
  if (!authStore.token) throw new Error('Missing auth token')

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authStore.token}`
    },
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error(`Image request failed (${response.status})`)
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}
