import type {
  AnalyticsReport,
  AgentAction,
  AgentNavigation,
  Comment,
  DraftGeneration,
  NetworkUser,
  Post,
  PostListFilters,
  PostListResponse,
  User,
  WorkspacePostLink,
  WritingStyleProfile
} from './types';
import { TOKEN_KEY } from './lib/authStorage';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

type AuthResponse = {
  token: string;
  user: User;
};

type MessageResponse = {
  ok?: boolean;
  message?: string;
  resetUrl?: string;
};

type PostPayload = {
  title: string;
  content: string;
  section: string;
  tags?: string[] | string;
};

type AgentResponse = {
  intent: string;
  reply: string;
  quickActions?: string[];
  posts?: Post[];
  authors?: Array<Record<string, unknown>>;
  draft?: PostPayload;
  styleProfile?: WritingStyleProfile | null;
  referencePosts?: Post[];
  generation?: DraftGeneration;
  actions?: AgentAction[];
  workspacePosts?: WorkspacePostLink[];
} & AgentNavigation;

function buildQuery(params: Record<string, string | number | string[] | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        search.set(key, value.join(','));
      }
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers: optionHeaders = {}, signal, ...restOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...restOptions,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...optionHeaders
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
  }
  return payload as T;
}

export { TOKEN_KEY };

export async function apiRegister(input: { name: string; email: string; password: string }) {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiLogin(input: { email: string; password: string }) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiRequestPasswordReset(input: { email: string }) {
  return request<MessageResponse>('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiConfirmPasswordReset(input: { token: string; newPassword: string }) {
  return request<MessageResponse>('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function apiMe(token: string) {
  return request<{ user: User }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetPosts(filters: PostListFilters = {}) {
  return request<PostListResponse>(`/api/posts${buildQuery(filters as Record<string, string | number | string[] | undefined>)}`);
}

export async function apiGetPost(postId: string) {
  return request<{ post: Post }>(`/api/posts/${postId}`);
}

export async function apiGetComments(postId: string) {
  return request<{ comments: Comment[] }>(`/api/posts/${postId}/comments`);
}

export async function apiAgentChat(message: string, token?: string, signal?: AbortSignal) {
  return request<AgentResponse>('/api/agent/chat', {
    method: 'POST',
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ message })
  });
}

export async function apiGetMyPosts(token: string) {
  return request<{ posts: Post[] }>('/api/account/posts', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetUserProfile(userId: string, token?: string) {
  return request<{
    user: User & {
      bio?: string;
      createdAt?: number;
      followerCount?: number;
      followingCount?: number;
      isFollowing?: boolean;
      isSelf?: boolean;
    };
    posts: Post[];
  }>(`/api/users/${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export async function apiGetFollowing(token: string) {
  return request<{
    users: NetworkUser[];
    following: NetworkUser[];
    followers: NetworkUser[];
    posts: Post[];
  }>('/api/account/following', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiFollowUser(userId: string, token: string) {
  return request<{ ok: boolean }>(`/api/users/${userId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUnfollowUser(userId: string, token: string) {
  return request<{ ok: boolean }>(`/api/users/${userId}/follow`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUpdateProfile(input: { name: string }, token: string) {
  return request<AuthResponse>('/api/account/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiUpdatePassword(input: { currentPassword: string; newPassword: string }, token: string) {
  return request<{ ok: boolean }>('/api/account/password', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiDeleteAccount(token: string) {
  return request<{ ok: boolean }>('/api/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiCreatePost(input: PostPayload, token: string) {
  return request<{ post: Post }>('/api/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiUpdatePost(postId: string, input: PostPayload, token: string) {
  return request<{ post: Post }>(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiAiRewritePost(
  postId: string,
  input: {
    instruction: string;
    draft?: PostPayload;
  },
  token: string,
  signal?: AbortSignal
) {
  return request<{ draft: PostPayload; generation: DraftGeneration }>(`/api/posts/${postId}/ai-rewrite`, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiDeletePost(postId: string, token: string) {
  return request<{ ok: boolean }>(`/api/posts/${postId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiCreateComment(postId: string, input: { content: string }, token: string) {
  return request<{ comment: Comment }>(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiAppealPost(postId: string, input: { note: string }, token: string) {
  return request<MessageResponse>(`/api/posts/${postId}/appeal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiGetModerationPosts(token: string) {
  return request<{ posts: Post[] }>('/api/admin/posts/moderation', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetAdminAnalytics(token: string, filters: Record<string, string | number> = {}) {
  return request<AnalyticsReport>(`/api/admin/analytics/overview${buildQuery(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiQueryAdminAnalytics(token: string, filters: Record<string, string | number> = {}) {
  return request<AnalyticsReport>(`/api/admin/analytics/query${buildQuery(filters)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetAdminParquetDatasets(token: string) {
  return request<{ datasets: Array<{ key: string; fileName: string }> }>('/api/admin/analytics/parquet', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiDownloadAdminParquetDataset(dataset: string, token: string) {
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

export async function apiAdminRemovePost(postId: string, input: { reason: string }, token: string) {
  return request<MessageResponse>(`/api/admin/posts/${postId}/remove`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiAdminRestorePost(postId: string, token: string) {
  return request<MessageResponse>(`/api/admin/posts/${postId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}
