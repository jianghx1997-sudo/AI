import request from '@/utils/request'

export function registerUser(data) {
  return request({
    url: '/api/auth/register',
    method: 'post',
    data
  })
}

export function loginUser(data) {
  return request({
    url: '/api/auth/login',
    method: 'post',
    data
  })
}

export function getCurrentUser() {
  return request({
    url: '/api/auth/me',
    method: 'get'
  })
}

export function logoutUser() {
  return request({
    url: '/api/auth/logout',
    method: 'post'
  })
}

export function updateCurrentUser(data) {
  return request({
    url: '/api/users/me',
    method: 'put',
    data
  })
}
