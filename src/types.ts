export type User = {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
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
  section?: string | string[];
  page?: number;
  pageSize?: number;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PostListResponse = {
  posts: Post[];
  pagination: Pagination;
  filters: {
    q: string;
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
