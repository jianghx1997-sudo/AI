<template>
  <div class="auth-page page-shell">
    <section class="auth-hero">
      <div class="eyebrow">AI 智能衣橱</div>
      <h1>{{ isRegister ? '创建你的衣橱账号' : '欢迎回来' }}</h1>
      <p>{{ isRegister ? '每个账号都有独立衣橱、穿着记录和推荐偏好。' : '登录后继续管理你的专属衣橱。' }}</p>
    </section>

    <van-form class="auth-card surface-card" @submit="submit">
      <van-field
        v-model="form.username"
        name="username"
        label="账号"
        placeholder="请输入账号"
        autocomplete="username"
        :rules="[{ required: true, message: '请输入账号' }]"
      />
      <van-field
        v-if="isRegister"
        v-model="form.display_name"
        name="display_name"
        label="昵称"
        placeholder="可选"
      />
      <van-field
        v-model="form.password"
        name="password"
        label="密码"
        type="password"
        placeholder="至少 6 位"
        autocomplete="current-password"
        :rules="[{ required: true, message: '请输入密码' }]"
      />

      <van-button round block type="primary" native-type="submit" :loading="loading">
        {{ isRegister ? '创建账号' : '登录' }}
      </van-button>

      <button class="mode-switch" type="button" @click="toggleMode">
        {{ isRegister ? '已有账号，去登录' : '没有账号，创建一个' }}
      </button>
    </van-form>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { loginUser, registerUser } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isRegister = ref(false)
const loading = ref(false)
const form = reactive({
  username: '',
  display_name: '',
  password: ''
})

const toggleMode = () => {
  isRegister.value = !isRegister.value
}

const submit = async () => {
  loading.value = true
  try {
    const payload = {
      username: form.username,
      password: form.password
    }
    if (isRegister.value) {
      payload.display_name = form.display_name || form.username
    }

    const res = isRegister.value ? await registerUser(payload) : await loginUser(payload)
    if (res.success) {
      authStore.setSession(res.data)
      showToast(isRegister.value ? '账号已创建' : '登录成功')
      router.replace(route.query.redirect || '/')
    }
  } catch (error) {
    showToast(error.message || '操作失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-top: 28px;
  padding-bottom: 28px;
}

.auth-hero {
  margin-bottom: 18px;
}

.eyebrow {
  color: var(--sw-primary);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
}

.auth-hero h1 {
  color: var(--sw-text);
  font-size: 28px;
  line-height: 1.22;
  margin-bottom: 9px;
}

.auth-hero p {
  color: var(--sw-text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.auth-card {
  padding: 16px;
}

.auth-card :deep(.van-cell) {
  padding-left: 0;
  padding-right: 0;
  background: transparent;
}

.auth-card .van-button {
  margin-top: 18px;
}

.mode-switch {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--sw-primary);
  font-size: 13px;
  font-weight: 650;
  padding: 14px 0 2px;
}
</style>
