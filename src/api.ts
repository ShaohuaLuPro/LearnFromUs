import type {
  AnalyticsReport,
  AgentAction,
  AgentForumOption,
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
  MediaAsset,
  MediaVisibility,
  NetworkUser,
  Post,
  PostInteractionState,
  PostListFilters,
  PostListResponse,
  SiteAdminAccessPayload,
  SiteAdminAccessEntry,
  UserInterestTag,
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
const MEDIA_TOKEN_PREFIX = 'media:';
const MAX_IMAGE_DIMENSION = 1600;
const TARGET_COMPRESSED_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_COMPRESSION_TRIGGER_BYTES = 1.5 * 1024 * 1024;
const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type AuthResponse = {
  token: string;
  user: User;
};

type MessageResponse = {
  ok?: boolean;
  message?: string;
  resetUrl?: string;
};

type PreparedMediaUpload = {
  asset: MediaAsset;
  upload: {
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
    expiresAt: number;
  };
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
  forumMatches?: AgentForumOption[];
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

function replaceFileExtension(fileName: string, nextExtension: string) {
  const cleanExtension = nextExtension.replace(/^\./, '').trim();
  const baseName = String(fileName || '')
    .replace(/\.[^./\\]+$/, '')
    .trim();
  return `${baseName || 'image'}.${cleanExtension}`;
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
export function resolveApiUrl(path: string) {
  const cleanPath = String(path || '').trim();
  if (!cleanPath) {
    return '';
  }

  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath;
  }

  return `${API_BASE_URL}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
}

export function buildMediaToken(assetId: string) {
  return `${MEDIA_TOKEN_PREFIX}${String(assetId || '').trim()}`;
}

export function resolveMediaSource(source?: string | null) {
  const rawSource = String(source || '').trim();
  if (!rawSource) {
    return '';
  }

  if (rawSource.startsWith('/api/media/')) {
    return resolveApiUrl(rawSource);
  }

  if (rawSource.startsWith('api/media/')) {
    return resolveApiUrl(rawSource);
  }

  if (rawSource.startsWith(MEDIA_TOKEN_PREFIX)) {
    const assetId = rawSource.slice(MEDIA_TOKEN_PREFIX.length).trim();
    if (!assetId) {
      return '';
    }
    return resolveApiUrl(`/api/media/${encodeURIComponent(assetId)}`);
  }

  return rawSource;
}

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

export async function apiGetPosts(filters: PostListFilters = {}, token?: string) {
  return request<PostListResponse>(`/api/posts${buildQuery(filters as Record<string, string | number | string[] | undefined>)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
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

export async function apiDeleteForum(forumId: string, token: string) {
  return request<{ ok: boolean; message?: string }>(`/api/forums/${forumId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetPost(postId: string, token?: string) {
  return request<{ post: Post }>(`/api/posts/${postId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export async function apiGetComments(postId: string) {
  return request<{ comments: Comment[] }>(`/api/posts/${postId}/comments`);
}

export async function apiRecordPostView(postId: string, token?: string) {
  return request<{ ok: boolean; viewCount: number }>(`/api/posts/${postId}/view`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export async function apiTrackPostEngagement(
  postId: string,
  input: { dwellTimeMs: number; source?: string },
  token: string
) {
  return request<{ ok: boolean; tracked: boolean; dwellTimeMs: number }>(`/api/posts/${postId}/engagement`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiLikePost(postId: string, token: string) {
  return request<{ ok: boolean } & PostInteractionState>(`/api/posts/${postId}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiUnlikePost(postId: string, token: string) {
  return request<{ ok: boolean } & PostInteractionState>(`/api/posts/${postId}/like`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiBookmarkPost(postId: string, token: string) {
  return request<{ ok: boolean } & PostInteractionState>(`/api/posts/${postId}/bookmark`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiRemovePostBookmark(postId: string, token: string) {
  return request<{ ok: boolean } & PostInteractionState>(`/api/posts/${postId}/bookmark`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetSavedPosts(token: string) {
  return request<{ posts: Post[] }>('/api/account/saved-posts', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetRecommendedPosts(token: string, limit = 8) {
  return request<{
    posts: Post[];
    topTags: UserInterestTag[];
    fallback: boolean;
    weights: Record<string, number>;
  }>(`/api/posts/recommended${buildQuery({ limit })}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiGetInterestSummary(token: string, limit = 24) {
  return request<{
    tags: UserInterestTag[];
    weights: Record<string, number>;
  }>(`/api/account/interests${buildQuery({ limit })}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
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

export async function apiCreateMediaUpload(
  input: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    visibility?: MediaVisibility;
  },
  token: string
) {
  return request<PreparedMediaUpload>('/api/media/upload-url', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiCompleteMediaUpload(
  assetId: string,
  input: {
    width?: number;
    height?: number;
    durationSeconds?: number;
    etag?: string;
  },
  token: string
) {
  return request<{ asset: MediaAsset }>(`/api/media/${assetId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input)
  });
}

export async function apiGetMyMedia(token: string, limit = 50) {
  return request<{ assets: MediaAsset[] }>(`/api/account/media${buildQuery({ limit })}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function apiDeleteMediaAsset(assetId: string, token: string) {
  return request<{ ok: boolean }>(`/api/media/${assetId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    image.src = objectUrl;
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read the selected image.'));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to compress the selected image.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

async function prepareImageForUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new Error('File is too large to upload.');
    }
    return {
      file,
      dimensions: null as { width: number; height: number } | null
    };
  }

  const dimensions = await readImageDimensions(file);
  if (!dimensions) {
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new Error('Image is too large to upload.');
    }
    return { file, dimensions: null };
  }

  const isCompressible = COMPRESSIBLE_IMAGE_TYPES.has(file.type);
  const needsResize = Math.max(dimensions.width, dimensions.height) > MAX_IMAGE_DIMENSION;
  const needsCompression = file.size > IMAGE_COMPRESSION_TRIGGER_BYTES;

  if (!isCompressible || (!needsResize && !needsCompression)) {
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new Error('Image is too large to upload.');
    }
    return { file, dimensions };
  }

  const image = await loadImageElement(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image compression is not available in this browser.');
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const nextFileName = replaceFileExtension(file.name, outputType === 'image/webp' ? 'webp' : 'jpg');
  const qualitySteps = outputType === 'image/jpeg'
    ? [0.82, 0.74, 0.66, 0.58]
    : [0.86, 0.78, 0.7, 0.62];

  let bestBlob: Blob | null = null;

  for (const quality of qualitySteps) {
    const blob = await canvasToBlob(canvas, outputType, quality);
    bestBlob = blob;
    if (blob.size <= TARGET_COMPRESSED_IMAGE_BYTES) {
      break;
    }
  }

  if (!bestBlob) {
    return { file, dimensions };
  }

  const compressedFile = new File([bestBlob], nextFileName, {
    type: outputType,
    lastModified: file.lastModified
  });

  const nextFile = (!needsResize && compressedFile.size >= file.size) ? file : compressedFile;
  if (nextFile.size > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error('Image is still too large after compression. Please choose a smaller image.');
  }

  return {
    file: nextFile,
    dimensions: nextFile === file ? dimensions : { width: targetWidth, height: targetHeight }
  };
}

export async function apiUploadMediaFile(
  file: File,
  token: string,
  options: { visibility?: MediaVisibility } = {}
) {
  const preparedFile = await prepareImageForUpload(file);
  const prepared = await apiCreateMediaUpload({
    fileName: preparedFile.file.name,
    contentType: preparedFile.file.type || 'application/octet-stream',
    sizeBytes: preparedFile.file.size,
    visibility: options.visibility || 'public'
  }, token);

  const uploadResponse = await fetch(prepared.upload.url, {
    method: prepared.upload.method,
    headers: prepared.upload.headers,
    body: preparedFile.file
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload the file to storage.');
  }

  const completed = await apiCompleteMediaUpload(prepared.asset.id, {
    etag: uploadResponse.headers.get('etag') || undefined,
    width: preparedFile.dimensions?.width,
    height: preparedFile.dimensions?.height
  }, token);

  return completed.asset;
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

export async function apiSearchUsers(query: string, limit = 6, token?: string) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return { users: [] as NetworkUser[] };
  }

  return request<{ users: NetworkUser[] }>(`/api/users/search${buildQuery({ q: cleanQuery, limit })}`, {
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

export async function apiUpdateProfile(
  input: { name: string; bio?: string; avatarAssetId?: string; removeAvatar?: boolean },
  token: string
) {
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
  input: { name: string; overview?: string; description: string; rationale: string; sectionScope: string[]; slug?: string },
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
  input: { name: string; overview?: string; description: string; rationale: string; sectionScope: string[]; slug?: string; appealNote: string },
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

export async function apiAiRewritePostDraft(
  input: {
    instruction: string;
    draft: PostPayload;
  },
  token: string,
  signal?: AbortSignal
) {
  return request<{ draft: PostPayload; generation: DraftGeneration }>('/api/posts/ai-rewrite-draft', {
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
