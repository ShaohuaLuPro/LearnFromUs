import type {
  AnalyticsReport,
  AgentAction,
  AgentNavigation,
  Comment,
  DraftGeneration,
  Forum,
  ForumAccessPayload,
  ForumFollower,
  ForumManager,
  ForumManagerInvite,
  ForumRequestDraft,
  ForumRequest,
  ForumWorkspace,
  NetworkUser,
  Post,
  PostListFilters,
  PostListResponse,
  SiteAdminAccessPayload,
  SiteAdminAccessEntry,
  User,
  WorkspacePostLink,
  WritingStyleProfile
} from './types';
import { TOKEN_KEY } from './lib/authStorage';

const PRODUCTION_API_BASE_URL = 'https://learnfromus.onrender.com';
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1']);

function isLocalApiUrl(url: string) {
  try {
    const parsed = new URL(url);
    return LOCAL_API_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveApiBaseUrl() {
  const configuredUrl = String(process.env.REACT_APP_API_BASE_URL || '').trim();

  if (configuredUrl) {
    if (process.env.NODE_ENV !== 'production' || !isLocalApiUrl(configuredUrl)) {
      return configuredUrl;
    }

    console.warn('Ignoring localhost API base URL in production. Falling back to the hosted API.');
  }

  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_API_BASE_URL
    : 'http://localhost:4000';
}

const API_BASE_URL = resolveApiBaseUrl();

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
  forumId?: string;
  tags?: string[] | string;
};

type AgentResponse = {
  intent: string;
  reply: string;
  quickActions?: string[];
  posts?: Post[];
  authors?: Array<Record<string, unknown>>;
  draft?: PostPayload;
  forumRequestDraft?: ForumRequestDraft;
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

export async function apiGetForums(token?: string) {
  return request<{
    forums: Forum[];
    workspace: ForumWorkspace | null;
  }>('/api/forums', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export async function apiFollowForum(forumId: string, token: string) {
  return request<{ ok: boolean }>(`/api/forums/${forumId}/follow`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUnfollowForum(forumId: string, token: string) {
  return request<{ ok: boolean }>(`/api/forums/${forumId}/follow`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUpdateForumSections(forumId: string, input: { sectionScope: string[] }, token: string) {
  return request<{ ok: boolean; message?: string; forum?: Forum | null }>(`/api/forums/${forumId}/sections`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiUpdateForumDetails(
  forumId: string,
  input: { description: string; showCodeBlockTools?: boolean },
  token: string
) {
  return request<{ ok: boolean; message?: string; forum?: Forum | null }>(`/api/forums/${forumId}/details`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
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

export async function apiGetForumFollowers(forumId: string, token: string) {
  return request<{ forum: Forum; followers: ForumFollower[] }>(`/api/forums/${forumId}/followers`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetSiteAdminAccess(token: string) {
  return request<SiteAdminAccessPayload>('/api/admin/access', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUpsertSiteAdminAccess(
  input: { identifier: string; permissions: string[] },
  token: string
) {
  return request<{ ok: boolean; admins: SiteAdminAccessEntry[]; message?: string }>('/api/admin/access', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiUpdateSiteAdminAccess(
  userId: string,
  input: { permissions: string[] },
  token: string
) {
  return request<{ ok: boolean; admins: SiteAdminAccessEntry[]; message?: string }>(`/api/admin/access/${userId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiRemoveSiteAdminAccess(userId: string, token: string) {
  return request<{ ok: boolean; admins: SiteAdminAccessEntry[]; message?: string }>(`/api/admin/access/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiAdminResetUserPassword(
  input: { identifier: string; newPassword: string },
  token: string
) {
  return request<{ ok: boolean; message?: string }>('/api/admin/users/reset-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiGetForumAccess(forumId: string, token: string) {
  return request<ForumAccessPayload>(`/api/forums/${forumId}/access`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUpsertForumManager(
  forumId: string,
  input: { identifier: string; permissions: string[] },
  token: string
) {
  return request<{ ok: boolean; manager: ForumManager | null; managers: ForumManager[]; invite?: ForumManagerInvite | null; message?: string }>(`/api/forums/${forumId}/managers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiUpdateForumManager(
  forumId: string,
  userId: string,
  input: { permissions: string[] },
  token: string
) {
  return request<{ ok: boolean; manager: ForumManager | null; managers: ForumManager[]; message?: string }>(`/api/forums/${forumId}/managers/${userId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiRemoveForumManager(forumId: string, userId: string, token: string) {
  return request<{ ok: boolean; managers: ForumManager[]; message?: string }>(`/api/forums/${forumId}/managers/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiTransferForumOwnership(forumId: string, input: { identifier: string }, token: string) {
  return request<{ ok: boolean; forum: Forum; message?: string }>(`/api/forums/${forumId}/transfer-ownership`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiGetForumManagerInvites(token: string) {
  return request<{ invites: ForumManagerInvite[] }>('/api/account/forum-manager-invites', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiAcceptForumManagerInvite(inviteId: string, token: string) {
  return request<{ ok: boolean; forum?: Forum | null; message?: string }>(`/api/account/forum-manager-invites/${inviteId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiRejectForumManagerInvite(inviteId: string, token: string) {
  return request<{ ok: boolean; message?: string }>(`/api/account/forum-manager-invites/${inviteId}/reject`, {
    method: 'POST',
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

export async function apiRequestForum(
  input: { name: string; description: string; rationale: string; sectionScope: string[]; slug?: string },
  token: string
) {
  return request<{ ok: boolean; message?: string; request: ForumRequest }>('/api/forums/requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiAiRewriteForumRequest(
  input: {
    instruction: string;
    draft: ForumRequestDraft;
  },
  token: string,
  signal?: AbortSignal
) {
  return request<{ draft: ForumRequestDraft; generation: DraftGeneration }>('/api/forums/requests/ai-rewrite', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiApproveForumRequest(requestId: string, input: { reviewNote?: string }, token: string) {
  return request<{ ok: boolean; message?: string; forum: Forum }>(`/api/forums/requests/${requestId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiRejectForumRequest(requestId: string, input: { reviewNote?: string }, token: string) {
  return request<{ ok: boolean; message?: string }>(`/api/forums/requests/${requestId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiAppealForumRequest(
  requestId: string,
  input: { name: string; description: string; rationale: string; sectionScope: string[]; slug?: string; appealNote: string },
  token: string
) {
  return request<{ ok: boolean; message?: string; request: ForumRequest }>(`/api/forums/requests/${requestId}/appeal`, {
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

export async function apiAdminReplyToPostAppeal(postId: string, input: { reason: string }, token: string) {
  return request<MessageResponse>(`/api/admin/posts/${postId}/reject-appeal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
    ,
    body: JSON.stringify(input)
  });
}

export async function apiAdminPermanentDeletePost(postId: string, input: { reason?: string }, token: string) {
  return request<MessageResponse>(`/api/admin/posts/${postId}/permanent-delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiOwnerRemovePost(forumId: string, postId: string, input: { reason: string }, token: string) {
  return request<MessageResponse>(`/api/forums/${forumId}/posts/${postId}/remove`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiOwnerRestorePost(forumId: string, postId: string, token: string) {
  return request<MessageResponse>(`/api/forums/${forumId}/posts/${postId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}
