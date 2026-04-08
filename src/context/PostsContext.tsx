import React, { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  apiAdminPermanentDeletePost,
  apiAdminReplyToPostAppeal,
  apiAppealForumRequest,
  apiApproveForumRequest,
  apiAdminRemovePost,
  apiAdminRestorePost,
  apiAgentChat,
  apiAiRewriteForumRequest,
  apiAiRewritePost,
  apiAiRewritePostDraft,
  apiAppealPost,
  apiBookmarkPost,
  apiCreateComment,
  apiCreatePost,
  apiDeletePost,
  apiDownloadAdminParquetDataset,
  apiGetForums,
  apiGetAdminAnalytics,
  apiGetInterestSummary,
  apiGetComments,
  apiGetAdminParquetDatasets,
  apiGetModerationPosts,
  apiGetMyPosts,
  apiOwnerRemovePost,
  apiOwnerRestorePost,
  apiGetPost,
  apiGetPosts,
  apiGetRecommendedPosts,
  apiGetSavedPosts,
  apiLikePost,
  apiQueryAdminAnalytics,
  apiRejectForumRequest,
  apiRemovePostBookmark,
  apiRequestForum,
  apiUnlikePost,
  apiUpdateForumSections,
  apiUpdatePost
} from '../api';
import { useAuth } from './AuthContext';
import type {
  AnalyticsReport,
  Comment,
  Forum,
  ForumRequest,
  ForumRequestDraft,
  ForumWorkspace,
  Pagination,
  Post,
  PostInteractionState,
  PostListFilters,
  UserInterestTag
} from '../types';

type ActionResult<T = undefined> = {
  ok: boolean;
  message?: string;
  data?: T;
  posts?: Post[];
  post?: Post;
  interaction?: PostInteractionState;
  forum?: Forum | null;
  comments?: Comment[];
  comment?: Comment;
  forums?: Forum[];
  workspace?: ForumWorkspace | null;
  request?: ForumRequest;
  datasets?: Array<{ key: string; fileName: string }>;
  tags?: UserInterestTag[];
  weights?: Record<string, number>;
  fallback?: boolean;
};

type PostsContextValue = {
  loadingPosts: boolean;
  loadingForums: boolean;
  posts: Post[];
  forums: Forum[];
  forumWorkspace: ForumWorkspace | null;
  pagination: Pagination;
  filters: Required<PostListFilters>;
  loadPosts: (filters?: PostListFilters) => Promise<ActionResult<Post[]>>;
  refreshPosts: () => Promise<ActionResult<Post[]>>;
  loadForums: () => Promise<ActionResult<Forum[]>>;
  createPost: (input: { title: string; content: string; section: string; forumId?: string; tags?: string | string[] }) => Promise<ActionResult>;
  updatePost: (postId: string, input: { title: string; content: string; section: string; forumId?: string; tags?: string | string[] }) => Promise<ActionResult>;
  aiRewritePost: (
    postId: string,
    input: { instruction: string; draft?: { title: string; content: string; section: string; forumId?: string; tags?: string | string[] } },
    signal?: AbortSignal
  ) => Promise<ActionResult<Record<string, unknown>>>;
  aiRewritePostDraft: (
    input: { instruction: string; draft: { title: string; content: string; section: string; forumId?: string; tags?: string | string[] } },
    signal?: AbortSignal
  ) => Promise<ActionResult<Record<string, unknown>>>;
  aiRewriteForumRequest: (
    input: { instruction: string; draft: ForumRequestDraft },
    signal?: AbortSignal
  ) => Promise<ActionResult<Record<string, unknown>>>;
  deletePost: (postId: string) => Promise<ActionResult>;
  getPostDetail: (postId: string) => Promise<ActionResult<Post>>;
  setPostLike: (postId: string, nextLiked: boolean) => Promise<ActionResult<PostInteractionState>>;
  setPostBookmark: (postId: string, nextBookmarked: boolean) => Promise<ActionResult<PostInteractionState>>;
  getSavedPosts: () => Promise<ActionResult<Post[]>>;
  getRecommendedPosts: (limit?: number) => Promise<ActionResult<Post[]>>;
  getInterestSummary: (limit?: number) => Promise<ActionResult<UserInterestTag[]>>;
  getComments: (postId: string) => Promise<ActionResult<Comment[]>>;
  createComment: (postId: string, input: { content: string }) => Promise<ActionResult<Comment>>;
  appealPost: (postId: string, note: string) => Promise<ActionResult>;
  getMyPosts: () => Promise<ActionResult<Post[]>>;
  getModerationPosts: () => Promise<ActionResult<Post[]>>;
  adminRemovePost: (postId: string, reason: string) => Promise<ActionResult>;
  adminRestorePost: (postId: string) => Promise<ActionResult>;
  adminReplyToPostAppeal: (postId: string, reason: string) => Promise<ActionResult>;
  adminPermanentDeletePost: (postId: string, reason?: string) => Promise<ActionResult>;
  ownerRemovePost: (forumId: string, postId: string, reason: string) => Promise<ActionResult>;
  ownerRestorePost: (forumId: string, postId: string) => Promise<ActionResult>;
  requestForum: (input: { name: string; overview?: string; description: string; rationale: string; sectionScope: string[]; slug?: string }) => Promise<ActionResult>;
  appealForumRequest: (
    requestId: string,
    input: { name: string; overview?: string; description: string; rationale: string; sectionScope: string[]; slug?: string; appealNote: string }
  ) => Promise<ActionResult>;
  updateForumSections: (forumId: string, sectionScope: string[]) => Promise<ActionResult>;
  approveForumRequest: (requestId: string, reviewNote?: string) => Promise<ActionResult>;
  rejectForumRequest: (requestId: string, reviewNote?: string) => Promise<ActionResult>;
  agentChat: (message: string, signal?: AbortSignal) => Promise<ActionResult<Record<string, unknown>>>;
  getAdminAnalytics: (filters?: Record<string, string | number>) => Promise<ActionResult<AnalyticsReport>>;
  queryAdminAnalytics: (filters?: Record<string, string | number>) => Promise<ActionResult<AnalyticsReport>>;
  getAdminParquetDatasets: () => Promise<ActionResult>;
  downloadAdminParquetDataset: (dataset: string) => Promise<ActionResult>;
  syncAuthorName: (authorId: string, authorName: string, authorAvatarUrl?: string) => void;
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
  forum: '',
  section: [],
  page: 1,
  pageSize: 10
};

const PostsContext = createContext<PostsContextValue | null>(null);

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const { getToken, currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [forumWorkspace, setForumWorkspace] = useState<ForumWorkspace | null>(null);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [filters, setFilters] = useState<Required<PostListFilters>>(DEFAULT_FILTERS);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingForums, setLoadingForums] = useState(true);
  const filtersRef = useRef<Required<PostListFilters>>(DEFAULT_FILTERS);
  const postsRef = useRef<Post[]>([]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const syncPostInteractionState = useCallback((postId: string, interaction: PostInteractionState) => {
    if (!postId) {
      return;
    }

    startTransition(() => {
      setPosts((current) => current.map((post) => (
        post.id === postId
          ? {
            ...post,
            likeCount: interaction.likeCount,
            bookmarkCount: interaction.bookmarkCount,
            isLiked: interaction.isLiked,
            isBookmarked: interaction.isBookmarked,
            savedAt: interaction.savedAt ?? null
          }
          : post
      )));
    });
  }, []);

  const loadPosts = useCallback(async (nextFilters: PostListFilters = {}) => {
    const mergedFilters: Required<PostListFilters> = {
      q: typeof nextFilters.q === 'string' ? nextFilters.q : filtersRef.current.q,
      forum: typeof nextFilters.forum === 'string' ? nextFilters.forum : filtersRef.current.forum,
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
      const data = await apiGetPosts(mergedFilters, getToken() || undefined);
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
    }
  }, [getToken]);

  useEffect(() => {
    loadPosts(filtersRef.current);
  }, [loadPosts, currentUser?.id]);

  const loadForums = useCallback(async () => {
    setLoadingForums(true);
    try {
      const data = await apiGetForums(getToken() || undefined);
      startTransition(() => {
        setForums(data.forums || []);
        setForumWorkspace(data.workspace || null);
      });
      return { ok: true, forums: data.forums || [], workspace: data.workspace || null };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load forums.' };
    } finally {
      setLoadingForums(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadForums();
  }, [loadForums, currentUser?.id]);

  const refreshPosts = useCallback(() => loadPosts(filtersRef.current), [loadPosts]);

  const createPost = useCallback(async (input: { title: string; content: string; section: string; forumId?: string; tags?: string | string[] }) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiCreatePost(input, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to create post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const updatePost = useCallback(async (postId: string, input: { title: string; content: string; section: string; forumId?: string; tags?: string | string[] }) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiUpdatePost(postId, input, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

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

  const aiRewritePostDraft = useCallback(async (
    input: { instruction: string; draft: { title: string; content: string; section: string; forumId?: string; tags?: string | string[] } },
    signal?: AbortSignal
  ) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAiRewritePostDraft(input, token, signal);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, message: 'Request cancelled.' };
      }
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to rewrite draft with AI.' };
    }
  }, [getToken]);

  const aiRewriteForumRequest = useCallback(async (
    input: { instruction: string; draft: ForumRequestDraft },
    signal?: AbortSignal
  ) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAiRewriteForumRequest(input, token, signal);
      return { ok: true, data };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, message: 'Request cancelled.' };
      }
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to rewrite forum request with AI.' };
    }
  }, [getToken]);

  const deletePost = useCallback(async (postId: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      await apiDeletePost(postId, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to delete post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const getPostDetail = useCallback(async (postId: string) => {
    try {
      const data = await apiGetPost(postId, getToken() || undefined);
      return { ok: true, post: data.post };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load post detail.' };
    }
  }, [getToken]);

  const setPostLike = useCallback(async (postId: string, nextLiked: boolean) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }

    const previousPost = postsRef.current.find((post) => post.id === postId);
    if (previousPost) {
      syncPostInteractionState(postId, {
        postId,
        likeCount: Math.max(0, Number(previousPost.likeCount || 0) + (nextLiked ? 1 : -1)),
        bookmarkCount: Number(previousPost.bookmarkCount || 0),
        isLiked: nextLiked,
        isBookmarked: Boolean(previousPost.isBookmarked),
        savedAt: previousPost.savedAt ?? null
      });
    }

    try {
      const data = nextLiked ? await apiLikePost(postId, token) : await apiUnlikePost(postId, token);
      const interaction: PostInteractionState = {
        postId: data.postId,
        likeCount: data.likeCount,
        bookmarkCount: data.bookmarkCount,
        isLiked: data.isLiked,
        isBookmarked: data.isBookmarked,
        savedAt: data.savedAt ?? null
      };
      syncPostInteractionState(postId, interaction);
      return { ok: true, interaction };
    } catch (error) {
      if (previousPost) {
        syncPostInteractionState(postId, {
          postId,
          likeCount: Number(previousPost.likeCount || 0),
          bookmarkCount: Number(previousPost.bookmarkCount || 0),
          isLiked: Boolean(previousPost.isLiked),
          isBookmarked: Boolean(previousPost.isBookmarked),
          savedAt: previousPost.savedAt ?? null
        });
      }
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update like.' };
    }
  }, [getToken, syncPostInteractionState]);

  const setPostBookmark = useCallback(async (postId: string, nextBookmarked: boolean) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }

    const previousPost = postsRef.current.find((post) => post.id === postId);
    if (previousPost) {
      syncPostInteractionState(postId, {
        postId,
        likeCount: Number(previousPost.likeCount || 0),
        bookmarkCount: Math.max(0, Number(previousPost.bookmarkCount || 0) + (nextBookmarked ? 1 : -1)),
        isLiked: Boolean(previousPost.isLiked),
        isBookmarked: nextBookmarked,
        savedAt: nextBookmarked ? Date.now() : null
      });
    }

    try {
      const data = nextBookmarked ? await apiBookmarkPost(postId, token) : await apiRemovePostBookmark(postId, token);
      const interaction: PostInteractionState = {
        postId: data.postId,
        likeCount: data.likeCount,
        bookmarkCount: data.bookmarkCount,
        isLiked: data.isLiked,
        isBookmarked: data.isBookmarked,
        savedAt: data.savedAt ?? null
      };
      syncPostInteractionState(postId, interaction);
      return { ok: true, interaction };
    } catch (error) {
      if (previousPost) {
        syncPostInteractionState(postId, {
          postId,
          likeCount: Number(previousPost.likeCount || 0),
          bookmarkCount: Number(previousPost.bookmarkCount || 0),
          isLiked: Boolean(previousPost.isLiked),
          isBookmarked: Boolean(previousPost.isBookmarked),
          savedAt: previousPost.savedAt ?? null
        });
      }
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update saved state.' };
    }
  }, [getToken, syncPostInteractionState]);

  const getSavedPosts = useCallback(async () => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.', posts: [] };
    }
    try {
      const data = await apiGetSavedPosts(token);
      return { ok: true, posts: data.posts || [] };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load saved posts.', posts: [] };
    }
  }, [getToken]);

  const getRecommendedPosts = useCallback(async (limit = 8) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.', posts: [] };
    }
    try {
      const data = await apiGetRecommendedPosts(token, limit);
      return {
        ok: true,
        posts: data.posts || [],
        tags: data.topTags || [],
        weights: data.weights || {},
        fallback: Boolean(data.fallback)
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load recommendations.', posts: [] };
    }
  }, [getToken]);

  const getInterestSummary = useCallback(async (limit = 24) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.', tags: [] };
    }
    try {
      const data = await apiGetInterestSummary(token, limit);
      return {
        ok: true,
        tags: data.tags || [],
        weights: data.weights || {}
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to load interest summary.', tags: [] };
    }
  }, [getToken]);

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
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to remove post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const adminRestorePost = useCallback(async (postId: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAdminRestorePost(postId, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to restore post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const adminReplyToPostAppeal = useCallback(async (postId: string, reason: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAdminReplyToPostAppeal(postId, { reason }, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to send admin appeal reply.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const adminPermanentDeletePost = useCallback(async (postId: string, reason = '') => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAdminPermanentDeletePost(postId, { reason }, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to permanently delete post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const ownerRemovePost = useCallback(async (forumId: string, postId: string, reason: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiOwnerRemovePost(forumId, postId, { reason }, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to moderate post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const ownerRestorePost = useCallback(async (forumId: string, postId: string) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiOwnerRestorePost(forumId, postId, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to restore post.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const requestForum = useCallback(async (input: { name: string; overview?: string; description: string; rationale: string; sectionScope: string[]; slug?: string }) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiRequestForum(input, token);
      await loadForums();
      return { ok: true, message: data.message, request: data.request };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to request forum.' };
    }
  }, [getToken, loadForums]);

  const appealForumRequest = useCallback(async (
    requestId: string,
    input: { name: string; overview?: string; description: string; rationale: string; sectionScope: string[]; slug?: string; appealNote: string }
  ) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiAppealForumRequest(requestId, input, token);
      await loadForums();
      return { ok: true, message: data.message, request: data.request };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to submit forum appeal.' };
    }
  }, [getToken, loadForums]);

  const updateForumSections = useCallback(async (forumId: string, sectionScope: string[]) => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiUpdateForumSections(forumId, { sectionScope }, token);
      const updatedForum = data.forum || null;
      if (updatedForum) {
        startTransition(() => {
          setForums((current) => current.map((forum) => (
            forum.id === updatedForum.id
              ? { ...forum, ...updatedForum, isFollowing: updatedForum.isFollowing ?? forum.isFollowing }
              : forum
          )));
          setForumWorkspace((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              ownedForums: current.ownedForums.map((forum) => (
                forum.id === updatedForum.id
                  ? { ...forum, ...updatedForum, isFollowing: updatedForum.isFollowing ?? forum.isFollowing }
                  : forum
              ))
            };
          });
        });
      }
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message, forum: updatedForum };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to update forum sections.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const approveForumRequest = useCallback(async (requestId: string, reviewNote = '') => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiApproveForumRequest(requestId, { reviewNote }, token);
      await Promise.all([refreshPosts(), loadForums()]);
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to approve forum request.' };
    }
  }, [getToken, loadForums, refreshPosts]);

  const rejectForumRequest = useCallback(async (requestId: string, reviewNote = '') => {
    const token = getToken();
    if (!token) {
      return { ok: false, message: 'Please login first.' };
    }
    try {
      const data = await apiRejectForumRequest(requestId, { reviewNote }, token);
      await loadForums();
      return { ok: true, message: data.message };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Failed to reject forum request.' };
    }
  }, [getToken, loadForums]);

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

  const syncAuthorName = useCallback((authorId: string, authorName: string, authorAvatarUrl = '') => {
    setPosts((current) => current.map((post) => (
      post.authorId === authorId ? { ...post, authorName, authorAvatarUrl } : post
    )));
  }, []);

  const removeAuthorPosts = useCallback((authorId: string) => {
    setPosts((current) => current.filter((post) => post.authorId !== authorId));
  }, []);

  const value = useMemo<PostsContextValue>(() => ({
    loadingPosts,
    loadingForums,
    posts,
    forums,
    forumWorkspace,
    pagination,
    filters,
    loadPosts,
    refreshPosts,
    loadForums,
    createPost,
    updatePost,
    aiRewritePost,
    aiRewritePostDraft,
    aiRewriteForumRequest,
    deletePost,
    getPostDetail,
    setPostLike,
    setPostBookmark,
    getSavedPosts,
    getRecommendedPosts,
    getInterestSummary,
    getComments,
    createComment,
    appealPost,
    getMyPosts,
    getModerationPosts,
    adminRemovePost,
    adminRestorePost,
    adminReplyToPostAppeal,
    adminPermanentDeletePost,
    ownerRemovePost,
    ownerRestorePost,
    requestForum,
    appealForumRequest,
    updateForumSections,
    approveForumRequest,
    rejectForumRequest,
    agentChat,
    getAdminAnalytics,
    queryAdminAnalytics,
    getAdminParquetDatasets,
    downloadAdminParquetDataset,
    syncAuthorName,
    removeAuthorPosts
  }), [
    loadingPosts,
    loadingForums,
    posts,
    forums,
    forumWorkspace,
    pagination,
    filters,
    loadPosts,
    refreshPosts,
    loadForums,
    createPost,
    updatePost,
    aiRewritePost,
    aiRewritePostDraft,
    aiRewriteForumRequest,
    deletePost,
    getPostDetail,
    setPostLike,
    setPostBookmark,
    getSavedPosts,
    getRecommendedPosts,
    getInterestSummary,
    getComments,
    createComment,
    appealPost,
    getMyPosts,
    getModerationPosts,
    adminRemovePost,
    adminRestorePost,
    adminReplyToPostAppeal,
    adminPermanentDeletePost,
    ownerRemovePost,
    ownerRestorePost,
    requestForum,
    appealForumRequest,
    updateForumSections,
    approveForumRequest,
    rejectForumRequest,
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
