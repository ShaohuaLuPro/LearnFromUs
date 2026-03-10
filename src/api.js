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

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
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

export async function apiRequestPasswordReset(input) {
  return request('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiConfirmPasswordReset(input) {
  return request('/api/auth/password-reset/confirm', {
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

export async function apiAgentChat(message, token) {
  return request('/api/agent/chat', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ message })
  });
}

export async function apiGetMyPosts(token) {
  return request('/api/account/posts', {
    headers: { Authorization: `Bearer ${token}` }
  });
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

export async function apiAppealPost(postId, input, token) {
  return request(`/api/posts/${postId}/appeal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiGetModerationPosts(token) {
  return request('/api/admin/posts/moderation', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetAdminAnalytics(token, filters = {}) {
  return request(withQuery('/api/admin/analytics/overview', filters), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiQueryAdminAnalytics(token, filters = {}) {
  return request(withQuery('/api/admin/analytics/query', filters), {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetAdminParquetDatasets(token) {
  return request('/api/admin/analytics/parquet', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiDownloadAdminParquetDataset(dataset, token) {
  const response = await fetch(`${API_BASE_URL}/api/admin/analytics/parquet/${encodeURIComponent(dataset)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Failed to download Parquet dataset.');
  }
  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(contentDisposition);
  return {
    blob,
    fileName: match?.[1] || `${dataset}.parquet`
  };
}

export async function apiAdminRemovePost(postId, input, token) {
  return request(`/api/admin/posts/${postId}/remove`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiAdminRestorePost(postId, token) {
  return request(`/api/admin/posts/${postId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}
