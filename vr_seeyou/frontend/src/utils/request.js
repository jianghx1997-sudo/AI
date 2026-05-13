import axios from 'axios'

// 创建 axios 实例
const request = axios.create({
  baseURL: '', // 使用相对路径，通过 Vite proxy 转发
  timeout: 90000, // 真实视觉模型识别可能需要较长时间
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  }
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 上传文件时使用 multipart/form-data
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data'
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('请求错误:', error)
    
    if (error.response) {
      // 服务器返回错误
      const msg = error.response.data?.error || `服务器错误 (${error.response.status})`
      return Promise.reject(new Error(msg))
    } else if (error.request) {
      // 请求未收到响应
      return Promise.reject(new Error('网络连接失败，请检查服务器是否运行'))
    } else {
      // 请求配置错误
      return Promise.reject(new Error(error.message))
    }
  }
)

export default request
