import React, { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  apiAdminRemovePost,
  apiAdminRestorePost,
  apiAgentChat,
  apiAiRewritePost,
  apiAppealPost,
  apiCreateComment,
  apiCreatePost,
  apiDeletePost,
  apiDownloadAdminParquetDataset,
  apiGetAdminAnalytics,
  apiGetComments,
  apiGetAdminParquetDatasets,
  apiGetModerationPosts,
  apiGetMyPosts,
  apiGetPost,
  apiGetPosts,
  apiQueryAdminAnalytics,
  apiUpdatePost
} from '../api';
import { useAuth } from './AuthContext';
import type { AnalyticsReport, Comment, Pagination, Post, PostListFilters } from '../types';

type ActionResult<T = undefined> = {
  ok: boolean;
  message?: string;
  data?: T;
  posts?: Post[];
  post?: Post;
  comments?: Comment[];
  comment?: Comment;
  datasets?: Array<{ key: string; fileName: string }>;
};

type PostsContextValue = {
  initialized: boolean;
  loadingPosts: boolean;
  posts: Post[];
  pagination: Pagination;
  filters: Required<PostListFilters>;
  loadPosts: (filters?: PostListFilters) => Promise<ActionResult<Post[]>>;
  refreshPosts: () => Promise<ActionResult<Post[]>>;
  createPost: (input: { title: string; content: string; section: string; tags?: string | string[] }) => Promise<ActionResult>;
  updatePost: (postId: string, input: { title: string; content: string; section: string; tags?: string | string[] }) => Promise<ActionResult>;
  aiRewritePost: (
    postId: string,
    input: { instruction: string; draft?: { title: string; content: string; section: string; tags?: string | string[] } },
    signal?: AbortSignal
  ) => Promise<ActionResult<Record<string, unknown>>>;
  deletePost: (postId: string) => Promise<ActionResult>;
  getPostDetail: (postId: string) => Promise<ActionResult<Post>>;
  getComments: (postId: string) => Promise<ActionResult<Comment[]>>;
  createComment: (postId: string, input: { content: string }) => Promise<ActionResult<Comment>>;
  appealPost: (postId: string, note: string) => Promise<ActionResult>;
  getMyPosts: () => Promise<ActionResult<Post[]>>;
  getModerationPosts: () => Promise<ActionResult<Post[]>>;
  adminRemovePost: (postId: string, reason: string) => Promise<ActionResult>;
  adminRestorePost: (postId: string) => Promise<ActionResult>;
  agentChat: (message: string, signal?: AbortSignal) => Promise<ActionResult<Record<string, unknown>>>;
  getAdminAnalytics: (filters?: Record<string, string | number>) => Promise<ActionResult<AnalyticsReport>>;
  queryAdminAnalytics: (filters?: Record<string, string | number>) => Promise<ActionResult<AnalyticsReport>>;
  getAdminParquetDatasets: () => Promise<ActionResult>;
  downloadAdminParquetDataset: (dataset: string) => Promise<ActionResult>;
  syncAuthorName: (authorId: string, authorName: string) => void;
  removeAuthorPosts: (authorId: string) => void;
};

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1
};

const DEFAULT_FILTERS: Required<PostListFilters> = {
  q: '',
  section: [],
  page: 1,
  pageSize: 10
};

const PostsContext = createContext<PostsContextValue | null>(null);

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [filters, setFilters] = useState<Required<PostListFilters>>(DEFAULT_FILTERS);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const filtersRef = useRef<Required<PostListFilters>>(DEFAULT_FILTERS);

  const loadPosts = useCallback(async (nextFilters: PostListFilters = {}) => {
    const mergedFilters: Required<PostListFilters> = {
      q: typeof nextFilters.q === 'string' ? nextFilters.q : filtersRef.current.q,
      section: Array.isArray(nextFilters.section)
        ? nextFilters.section
        : typeof nextFilters.section === 'string'
          ? nextFilters.section ? [nextFilters.section] : []
          : filtersRef.current.section,
      page: typeof nextFilters.page === 'number' ? nextFilters.page : filtersRef.current.page,
      pageSize: nextFilters.pageSize === 'all' || typeof nextFilters.pageSize === 'number'
        ? nextFilters.pageSize
        : filtersRef.current.pageSize
    };

    setLoadingPosts(true);
    try {
      const data = await apiGetPosts(mergedFilters);
      startTransition(() => {
        filtersRef.current = mergedFilters;
        setPosts(data.posts || []);
        setPagination(data.pagination || DEFAULT_PAGINATION);
        setFilters(mergedFilters);
      });
      return { ok: true, data: data.posts || [], posts: data.posts || [] };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load posts.' };
    } finally {
      setLoadingPosts(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    loadPosts(DEFAULT_FILTERS);
  }, [loadPosts]);

  const refreshPosts = useCallback(() => loadPosts(filtersRef.current), [loadPosts]);

  const createPost = useCallback(async (input: { title: string; content: string; section: string; tags?: string | string[] }) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiCreatePost(input, token);
      await refreshPosts();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to create post.' };
    }
  }, [getToken, refreshPosts]);

  const updatePost = useCallback(async (postId: string, input: { title: string; content: string; section: string; tags?: string | string[] }) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiUpdatePost(postId, input, token);
      await refreshPosts();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update post.' };
    }
  }, [getToken, refreshPosts]);

  const aiRewritePost = useCallback(async (
    postId: string,
    input: { instruction: string; draft?: { title: string; content: string; section: string; tags?: string | string[] } },
    signal?: AbortSignal
  ) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAiRewritePost(postId, input, token, signal);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, message: 'Request cancelled.' };
      }
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to rewrite post with AI.' };
    }
  }, [getToken]);

  const deletePost = useCallback(async (postId: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiDeletePost(postId, token);
      await refreshPosts();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete post.' };
    }
  }, [getToken, refreshPosts]);

  const getPostDetail = useCallback(async (postId: string) => {
    try {
      const data = await apiGetPost(postId);
      return { ok: true, post: data.post };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load post detail.' };
    }
  }, []);

  const getComments = useCallback(async (postId: string) => {
    try {
      const data = await apiGetComments(postId);
      return { ok: true, comments: data.comments || [] };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load comments.', comments: [] };
    }
  }, []);

  const createComment = useCallback(async (postId: string, input: { content: string }) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiCreateComment(postId, input, token);
      return { ok: true, comment: data.comment };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to create comment.' };
    }
  }, [getToken]);

  const appealPost = useCallback(async (postId: string, note: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAppealPost(postId, { note }, token);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to submit appeal.' };
    }
  }, [getToken]);

  const getMyPosts = useCallback(async () => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.', posts: [] };
    }
    try {
      const data = await apiGetMyPosts(token);
      return { ok: true, posts: data.posts || [] };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load your posts.', posts: [] };
    }
  }, [getToken]);

  const getModerationPosts = useCallback(async () => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.', posts: [] };
    }
    try {
      const data = await apiGetModerationPosts(token);
      return { ok: true, posts: data.posts || [] };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load moderation posts.', posts: [] };
    }
  }, [getToken]);

  const adminRemovePost = useCallback(async (postId: string, reason: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAdminRemovePost(postId, { reason }, token);
      await refreshPosts();
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to remove post.' };
    }
  }, [getToken, refreshPosts]);

  const adminRestorePost = useCallback(async (postId: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAdminRestorePost(postId, token);
      await refreshPosts();
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to restore post.' };
    }
  }, [getToken, refreshPosts]);

  const agentChat = useCallback(async (message: string, signal?: AbortSignal) => {
    try {
      const data = await apiAgentChat(message, getToken() || undefined, signal);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, message: 'Request cancelled.' };
      }
      return { ok: false, message: error instanceof Error ? error.message : 'Agent request failed.' };
    }
  }, [getToken]);

  const getAdminAnalytics = useCallback(async (filtersInput: Record<string, string | number> = {}) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiGetAdminAnalytics(token, filtersInput);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load analytics.' };
    }
  }, [getToken]);

  const queryAdminAnalytics = useCallback(async (filtersInput: Record<string, string | number> = {}) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiQueryAdminAnalytics(token, filtersInput);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to run analytics query.' };
    }
  }, [getToken]);

  const getAdminParquetDatasets = useCallback(async () => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.', datasets: [] };
    }
    try {
      const data = await apiGetAdminParquetDatasets(token);
      return { ok: true, datasets: data.datasets || [] };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load Parquet datasets.', datasets: [] };
    }
  }, [getToken]);

  const downloadAdminParquetDataset = useCallback(async (dataset: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const { blob, fileName } = await apiDownloadAdminParquetDataset(dataset, token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to download Parquet dataset.' };
    }
  }, [getToken]);

  const syncAuthorName = useCallback((authorId: string, authorName: string) => {
    setPosts((current) => current.map((post) => (
      post.authorId === authorId ? { ...post, authorName } : post
    )));
  }, []);

  const removeAuthorPosts = useCallback((authorId: string) => {
    setPosts((current) => current.filter((post) => post.authorId !== authorId));
  }, []);

  const value = useMemo<PostsContextValue>(() => ({
    initialized,
    loadingPosts,
    posts,
    pagination,
    filters,
    loadPosts,
    refreshPosts,
    createPost,
    updatePost,
    aiRewritePost,
    deletePost,
    getPostDetail,
    getComments,
    createComment,
    appealPost,
    getMyPosts,
    getModerationPosts,
    adminRemovePost,
    adminRestorePost,
    agentChat,
    getAdminAnalytics,
    queryAdminAnalytics,
    getAdminParquetDatasets,
    downloadAdminParquetDataset,
    syncAuthorName,
    removeAuthorPosts
  }), [
    initialized,
    loadingPosts,
    posts,
    pagination,
    filters,
    loadPosts,
    refreshPosts,
    createPost,
    updatePost,
    aiRewritePost,
    deletePost,
    getPostDetail,
    getComments,
    createComment,
    appealPost,
    getMyPosts,
    getModerationPosts,
    adminRemovePost,
    adminRestorePost,
    agentChat,
    getAdminAnalytics,
    queryAdminAnalytics,
    getAdminParquetDatasets,
    downloadAdminParquetDataset,
    syncAuthorName,
    removeAuthorPosts
  ]);

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}

export function usePosts() {
  const value = useContext(PostsContext);
  if (!value) {
    throw new Error('usePosts must be used within PostsProvider.');
  }
  return value;
}
