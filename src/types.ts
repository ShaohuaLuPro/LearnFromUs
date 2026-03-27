export type User = {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  adminPermissions?: SiteAdminPermissionKey[];
  hasAdminAccess?: boolean;
  canManageAdminAccess?: boolean;
};

export type SiteAdminPermissionKey =
  | 'manage_admin_access'
  | 'moderation'
  | 'analytics'
  | 'forum_requests'
  | 'password_reset';

export type SiteAdminPermissionDetail = {
  key: SiteAdminPermissionKey;
  label: string;
  description: string;
};

export type SiteAdminAccessEntry = {
  id: string;
  name: string;
  email: string;
  permissions: SiteAdminPermissionKey[];
  grantedById: string | null;
  grantedByName?: string;
  createdAt: number | null;
  updatedAt: number | null;
  isRootAdmin?: boolean;
};

export type SiteAdminAccessPayload = {
  admins: SiteAdminAccessEntry[];
  availablePermissions: SiteAdminPermissionDetail[];
  viewerPermissions: SiteAdminPermissionKey[];
  canManageAdminAccess: boolean;
};

export type Forum = {
  id: string;
  slug: string;
  name: string;
  description: string;
  ownerId: string | null;
  ownerName?: string;
  sectionScope: string[];
  postCount?: number;
  livePostCount?: number;
  moderatedCount?: number;
  followerCount?: number;
  isCore?: boolean;
  isFollowing?: boolean;
  isOwner?: boolean;
  canManage?: boolean;
  currentUserPermissions?: ForumPermissionKey[];
};

export type ForumFollower = {
  id: string;
  name: string;
  followedAt: number | null;
};

export type ForumPermissionKey =
  | 'manage_admins'
  | 'manage_sections'
  | 'view_followers'
  | 'moderate_posts'
  | 'review_appeals'
  | 'publish_announcements';

export type ForumPermissionDetail = {
  key: ForumPermissionKey;
  label: string;
  description: string;
};

export type ForumManager = {
  id: string;
  name: string;
  permissions: ForumPermissionKey[];
  grantedById: string | null;
  grantedByName?: string;
  createdAt: number | null;
  updatedAt: number | null;
};

export type ForumManagerInvite = {
  id: string;
  forumId: string;
  forumSlug: string;
  forumName: string;
  forumDescription: string;
  permissions: ForumPermissionKey[];
  invitedById: string | null;
  invitedByName?: string;
  createdAt: number | null;
};

export type ForumAccessPayload = {
  forum: Forum;
  owner: { id: string; name: string } | null;
  managers: ForumManager[];
  availablePermissions: ForumPermissionDetail[];
  viewerPermissions: ForumPermissionKey[];
  canManageAdmins: boolean;
  canTransferOwnership: boolean;
};

export type ForumRequest = {
  id: string;
  requesterId: string;
  requesterName?: string;
  forumId: string | null;
  forumSlug?: string;
  forumName?: string;
  slug: string;
  name: string;
  description: string;
  sectionScope: string[];
  rationale: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string;
  reviewedById?: string | null;
  reviewedByName?: string;
  createdAt: number | null;
  reviewedAt: number | null;
};

export type ForumRequestDraft = {
  name: string;
  overview?: string;
  description: string;
  rationale: string;
  sectionScope: string[];
};

export type ForumWorkspace = {
  ownedForums: Forum[];
  myRequests: ForumRequest[];
  pendingRequests: ForumRequest[];
  moderatedPosts: Post[];
};

export type NetworkUser = {
  id: string;
  name: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
};

export type ModerationState = {
  isDeleted: boolean;
  deletedAt: number | null;
  deletedByAdminId: string | null;
  deletedReason: string;
  appealRequestedAt: number | null;
  appealNote: string;
  restoredAt: number | null;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number | null;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  forum?: Forum | null;
  section: string;
  tags: string[];
  moderation: ModerationState;
};

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  createdAt: number;
  updatedAt: number | null;
};

export type PostListFilters = {
  q?: string;
  forum?: string;
  section?: string | string[];
  page?: number;
  pageSize?: number | 'all';
};

export type Pagination = {
  page: number;
  pageSize: number | 'all';
  total: number;
  totalPages: number;
};

export type PostListResponse = {
  posts: Post[];
  pagination: Pagination;
  filters: {
    q: string;
    forum?: string;
    section: string[];
  };
};

export type AnalyticsReport = {
  engine?: string;
  databasePath?: string;
  filters?: Record<string, unknown>;
  overview?: Record<string, number>;
  sections?: Array<Record<string, unknown>>;
  authors?: Array<Record<string, unknown>>;
  activityTypes?: Array<Record<string, unknown>>;
  moderation?: Array<Record<string, unknown>>;
  topTags?: Array<Record<string, unknown>>;
  activityTrend?: Array<Record<string, unknown>>;
  dailyLeaderboard?: Array<Record<string, unknown>>;
  availableFilters?: {
    sections?: string[];
    tags?: string[];
  };
};

export type WritingStyleProfile = {
  summary: string;
  sampleSize: number;
  avgWordCount: number;
  avgTitleLength: number;
  preferredSections: string[];
  commonTags: string[];
  tone: string[];
  structure: string[];
  openerStyle: string;
  closingStyle: string;
  titlePattern: string;
  recurringTerms: string[];
  updatedAt?: number | null;
};

export type DraftGeneration = {
  mode: string;
  provider: string;
  model?: string | null;
  fallback?: boolean;
  rationale?: string;
};

export type AgentAction = {
  label: string;
  to: string;
};

export type WorkspacePostLink = {
  id: string;
  title: string;
  section: string;
  to: string;
};

export type AgentNavigation = {
  navigateTo?: string;
  autoNavigate?: boolean;
};
