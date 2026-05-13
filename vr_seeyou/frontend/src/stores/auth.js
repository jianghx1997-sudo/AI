import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const TOKEN_KEY = 'seeyou_auth_token'
const USER_KEY = 'seeyou_auth_user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref(readStoredUser())
  const isAuthenticated = computed(() => Boolean(token.value))

  const setSession = ({ token: nextToken, user: nextUser }) => {
    token.value = nextToken || ''
    user.value = nextUser || null

    if (token.value) {
      localStorage.setItem(TOKEN_KEY, token.value)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }

    if (user.value) {
      localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }

  const setUser = (nextUser) => {
    user.value = nextUser || null
    if (user.value) {
      localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }

  const clearSession = () => {
    setSession({ token: '', user: null })
  }

  return {
    token,
    user,
    isAuthenticated,
    setSession,
    setUser,
    clearSession
  }
})
