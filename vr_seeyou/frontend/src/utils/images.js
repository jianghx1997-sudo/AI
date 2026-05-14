import { useAuthStore } from '@/stores/auth'

export function getImageUrl(itemOrPath, version = '') {
  const rawPath = typeof itemOrPath === 'string' ? itemOrPath : itemOrPath?.image_path
  if (!rawPath) return ''

  const authStore = useAuthStore()
  const relativePath = String(rawPath)
    .replace(/^\/uploads\//, '')
    .split('/')
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join('/')

  const params = new URLSearchParams()
  if (authStore.token) params.set('token', authStore.token)
  const cacheVersion = version || itemOrPath?.updated_at || itemOrPath?.created_at || Date.now()
  params.set('v', cacheVersion)

  return `/api/images/${relativePath}?${params.toString()}`
}
