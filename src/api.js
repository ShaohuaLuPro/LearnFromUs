const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

export const TOKEN_KEY = 'lfu_token_v1';

async function request(path, options = {}) {
  const { headers: optionHeaders = {}, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...optionHeaders
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
  }
  return payload;
}

export async function apiRegister(input) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiLogin(input) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiMe(token) {
  return request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetPosts() {
  return request('/api/posts');
}

export async function apiGetUserProfile(userId, token) {
  return request(`/api/users/${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export async function apiGetFollowing(token) {
  return request('/api/account/following', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiFollowUser(userId, token) {
  return request(`/api/users/${userId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUnfollowUser(userId, token) {
  return request(`/api/users/${userId}/follow`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUpdateProfile(input, token) {
  return request('/api/account/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiUpdatePassword(input, token) {
  return request('/api/account/password', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiDeleteAccount(token) {
  return request('/api/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiCreatePost(input, token) {
  return request('/api/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiUpdatePost(postId, input, token) {
  return request(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiDeletePost(postId, token) {
  return request(`/api/posts/${postId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}
