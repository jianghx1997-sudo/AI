<template>
  <div class="profile-page page-shell">
    <van-nav-bar title="个人资料" left-arrow fixed placeholder @click-left="$router.back()" />

    <section class="profile-card surface-card">
      <div class="avatar">{{ initials }}</div>
      <div>
        <h1>{{ authStore.user?.display_name || authStore.user?.username }}</h1>
        <p>@{{ authStore.user?.username }}</p>
      </div>
    </section>

    <van-form class="profile-form surface-card" @submit="saveProfile">
      <van-field
        v-model="displayName"
        name="display_name"
        label="昵称"
        placeholder="请输入昵称"
        :rules="[{ required: true, message: '请输入昵称' }]"
      />
      <van-button round block type="primary" native-type="submit" :loading="saving">
        保存资料
      </van-button>
    </van-form>

    <section class="account-card surface-card">
      <div class="account-row">
        <span>账号</span>
        <strong>{{ authStore.user?.username }}</strong>
      </div>
      <div class="account-row">
        <span>角色</span>
        <strong>{{ authStore.user?.role || 'user' }}</strong>
      </div>
      <van-button round block plain class="logout-button" :loading="loggingOut" @click="logout">
        退出登录
      </van-button>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { logoutUser, updateCurrentUser } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const displayName = ref('')
const saving = ref(false)
const loggingOut = ref(false)

watchEffect(() => {
  displayName.value = authStore.user?.display_name || ''
})

const initials = computed(() => {
  const source = authStore.user?.display_name || authStore.user?.username || '我'
  return source.slice(0, 1).toUpperCase()
})

const saveProfile = async () => {
  saving.value = true
  try {
    const res = await updateCurrentUser({ display_name: displayName.value })
    if (res.success) {
      authStore.setUser(res.data)
      showToast('资料已更新')
    }
  } catch (error) {
    showToast(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const logout = async () => {
  loggingOut.value = true
  try {
    await logoutUser()
  } catch (error) {
    // v1 退出由客户端清 token，后端失败也允许本地退出。
  } finally {
    authStore.clearSession()
    loggingOut.value = false
    router.replace('/login')
  }
}
</script>

<style scoped>
.profile-page {
  padding-top: 14px;
}

.profile-card,
.profile-form,
.account-card {
  padding: 16px;
  margin-bottom: 14px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--sw-primary-soft);
  color: var(--sw-primary);
  font-size: 22px;
  font-weight: 750;
}

.profile-card h1 {
  color: var(--sw-text);
  font-size: 20px;
  line-height: 1.25;
  margin-bottom: 4px;
}

.profile-card p {
  color: var(--sw-text-muted);
  font-size: 13px;
}

.profile-form :deep(.van-cell) {
  padding-left: 0;
  padding-right: 0;
  background: transparent;
}

.profile-form .van-button {
  margin-top: 16px;
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--sw-border);
}

.account-row span {
  color: var(--sw-text-muted);
  font-size: 13px;
}

.account-row strong {
  color: var(--sw-text);
  font-size: 14px;
}

.logout-button {
  margin-top: 16px;
  color: #9b4a31;
}
</style>
