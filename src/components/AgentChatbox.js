import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSectionLabel } from '../lib/sections';
import './AgentChatbox.css';

const BASE_SUGGESTIONS = [
  {
    key: 'ask-anything',
    label: 'Ask anything',
    prompt: 'Help me find the most useful discussions to start with today.'
  },
  {
    key: 'summarize-page',
    label: 'Summarize this page',
    prompt: 'Summarize what is on this page and tell me what matters most.'
  },
  {
    key: 'discover',
    label: 'Help me find something',
    prompt: 'Show me recent high-signal posts about analytics and product experiments.'
  },
  {
    key: 'draft-post',
    label: 'Draft a post',
    prompt: 'Draft a practical post about PostgreSQL indexing trade-offs for production systems.'
  }
];

const MEMBER_SUGGESTIONS = [
  ...BASE_SUGGESTIONS,
  {
    key: 'my-content',
    label: 'Improve my workflow',
    prompt: 'Take me to my posts and suggest which one I should improve first.'
  }
];

const QUICK_ACTION_PROMPTS = {
  'search-posts': 'Find related posts for this topic and show the most relevant ones first.',
  'show-trending': 'Show me the latest active discussions worth reading.',
  'draft-post': 'Draft a new post with a practical, publish-ready structure.',
  'publish-draft': 'Refine this draft and make it ready to publish.',
  'login-to-publish': 'What can I do before logging in, and what unlocks after login?'
};

function createMessage({ role, text, payload = null }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    payload,
    createdAt: new Date().toISOString()
  };
}

function formatTimestamp(isoValue) {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(isoValue));
  } catch (_) {
    return '';
  }
}

function resolveAssistantText(payload) {
  return String(payload?.reply || payload?.message || 'Done.').trim();
}

export default function AgentChatbox({ currentUser, onAgentChat, onCreatePost }) {
  const navigate = useNavigate();
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 991.98px)').matches
  ));
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const suggestions = useMemo(
    () => (currentUser ? MEMBER_SUGGESTIONS : BASE_SUGGESTIONS),
    [currentUser]
  );

  const scrollToBottom = useCallback(() => {
    if (!threadRef.current) {
      return;
    }
    const thread = threadRef.current;
    window.requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 991.98px)');
    const sync = (event) => {
      const nextMobile = event?.matches ?? mediaQuery.matches;
      setIsMobile(nextMobile);
      if (nextMobile) {
        setIsExpanded(false);
      }
    };
    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!isOpen || !isMobile) {
      document.body.classList.remove('assistant-mobile-open');
      return;
    }
    document.body.classList.add('assistant-mobile-open');
    return () => document.body.classList.remove('assistant-mobile-open');
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    scrollToBottom();
  }, [isOpen, messages, loading, scrollToBottom]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const handleOpenRequest = () => setIsOpen(true);
    window.addEventListener('assistant:open', handleOpenRequest);
    return () => window.removeEventListener('assistant:open', handleOpenRequest);
  }, []);

  const clearConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  }, []);

  const openDraftInComposer = useCallback((draft) => {
    if (!draft) {
      return;
    }
    navigate('/forum?compose=1', {
      state: {
        composerDraft: {
          title: draft.title,
          content: draft.content,
          forumId: draft.forumId,
          section: draft.section,
          tags: draft.tags || []
        }
      }
    });
  }, [navigate]);

  const openForumRequestDraft = useCallback((forumRequestDraft) => {
    if (!forumRequestDraft) {
      return;
    }

    navigate('/forums/request', {
      state: {
        forumRequestDraft: {
          name: forumRequestDraft.name,
          overview: forumRequestDraft.overview,
          description: forumRequestDraft.description,
          rationale: forumRequestDraft.rationale,
          sectionScope: forumRequestDraft.sectionScope || []
        }
      }
    });
  }, [navigate]);

  const publishDraft = useCallback(async (draft) => {
    if (!draft || loading) {
      return;
    }

    const result = await onCreatePost(draft);
    setMessages((current) => [
      ...current,
      createMessage({
        role: 'assistant',
        text: result.ok
          ? 'Draft published. Opening the feed now.'
          : (result.message || 'Publishing failed.')
      })
    ]);

    if (result.ok) {
      navigate('/forum');
    }
  }, [loading, navigate, onCreatePost]);

  const sendMessage = useCallback(async (nextValue) => {
    const messageText = String(nextValue ?? input).trim();
    if (!messageText || loading) {
      return;
    }

    setInput('');
    setMessages((current) => [...current, createMessage({ role: 'user', text: messageText })]);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await onAgentChat(messageText, controller.signal);
      abortControllerRef.current = null;
      setLoading(false);

      if (!result.ok) {
        if (result.message === 'Request cancelled.') {
          return;
        }
        setMessages((current) => [
          ...current,
          createMessage({ role: 'assistant', text: result.message || 'Agent request failed.' })
        ]);
        return;
      }

      const payload = result.data || {};
      if (payload.navigateTo && payload.autoNavigate) {
        navigate(payload.navigateTo);
      }

      setMessages((current) => [
        ...current,
        createMessage({
          role: 'assistant',
          text: resolveAssistantText(payload),
          payload
        })
      ]);
    } catch (error) {
      abortControllerRef.current = null;
      setLoading(false);
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setMessages((current) => [
        ...current,
        createMessage({
          role: 'assistant',
          text: error?.message || 'Agent request failed.'
        })
      ]);
    }
  }, [input, loading, navigate, onAgentChat]);

  const handlePromptClick = (prompt) => {
    if (!isOpen) {
      setIsOpen(true);
    }
    sendMessage(prompt);
  };

  const handleQuickAction = (actionKey) => {
    const prompt = QUICK_ACTION_PROMPTS[actionKey];
    if (!prompt) {
      return;
    }
    sendMessage(prompt);
  };

  const stopThinking = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
  };

  const renderAssistantExtras = (message) => {
    const payload = message.payload || {};

    return (
      <>
        {payload.actions?.length > 0 ? (
          <div className="assistant-actions-row">
            {payload.actions.map((action) => (
              <Link key={`${message.id}-${action.to}-${action.label}`} to={action.to} className="assistant-action-link">
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}

        {payload.posts?.length > 0 ? (
          <div className="assistant-card-grid">
            {payload.posts.map((post) => (
              <Link key={post.id} to={`/forum/post/${post.id}`} className="assistant-card-link">
                <strong>{post.title}</strong>
                <span>{post.authorName}</span>
                <span>{getSectionLabel(post.section)}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {payload.authors?.length > 0 ? (
          <div className="assistant-card-grid">
            {payload.authors.map((author) => (
              <div key={`${author.author_email}-${author.rank || author.author_name}`} className="assistant-card-link">
                <strong>{author.author_name}</strong>
                <span>{author.post_count} posts</span>
                {author.score !== undefined ? <span>score {author.score}</span> : null}
              </div>
            ))}
          </div>
        ) : null}

        {payload.draft ? (
          <div className="assistant-draft-block">
            <strong>{payload.draft.title}</strong>
            <span>{getSectionLabel(payload.draft.section)}</span>
            <pre>{payload.draft.content}</pre>
            <div className="assistant-actions-row">
              <button type="button" className="assistant-action-link is-button" onClick={() => openDraftInComposer(payload.draft)}>
                Edit in Composer
              </button>
              {currentUser ? (
                <button type="button" className="assistant-action-link is-button is-primary" onClick={() => publishDraft(payload.draft)}>
                  Publish Draft
                </button>
              ) : (
                <Link to="/login" className="assistant-action-link is-primary">
                  Login to Publish
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {payload.forumRequestDraft ? (
          <div className="assistant-draft-block">
            <strong>{payload.forumRequestDraft.name}</strong>
            <p>{payload.forumRequestDraft.overview || payload.forumRequestDraft.description}</p>
            <div className="assistant-actions-row">
              {currentUser ? (
                <button type="button" className="assistant-action-link is-button is-primary" onClick={() => openForumRequestDraft(payload.forumRequestDraft)}>
                  Open Request Form
                </button>
              ) : (
                <Link to="/login" className="assistant-action-link is-primary">
                  Login to Request
                </Link>
              )}
            </div>
          </div>
        ) : null}

        {payload.quickActions?.length > 0 ? (
          <div className="assistant-chip-row">
            {payload.quickActions.map((actionKey) => (
              QUICK_ACTION_PROMPTS[actionKey] ? (
                <button
                  key={`${message.id}-${actionKey}`}
                  type="button"
                  className="assistant-chip"
                  onClick={() => handleQuickAction(actionKey)}
                >
                  {actionKey.replaceAll('-', ' ')}
                </button>
              ) : null
            ))}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className={`assistant-dock ${isOpen ? 'is-open' : ''} ${isMobile ? 'is-mobile' : ''}`.trim()}>
      {isOpen ? (
        <>
          {isMobile ? <button type="button" className="assistant-overlay" onClick={() => setIsOpen(false)} aria-label="Close assistant" /> : null}
          <aside className={`assistant-panel ${isExpanded ? 'is-expanded' : ''}`.trim()} aria-label="AI Assistant Panel">
            <header className="assistant-header">
              <div>
                <p className="assistant-kicker">Assistant</p>
                <h3>AI Assistant</h3>
                <p className="assistant-subtitle">Discovery, drafting, and workflow help in one place.</p>
              </div>
              <div className="assistant-header-actions">
                {!isMobile ? (
                  <button
                    type="button"
                    className="assistant-icon-btn"
                    onClick={() => setIsExpanded((current) => !current)}
                    aria-label={isExpanded ? 'Compact panel' : 'Expand panel'}
                  >
                    {isExpanded ? 'Compact' : 'Expand'}
                  </button>
                ) : null}
                <button type="button" className="assistant-icon-btn" onClick={clearConversation}>
                  Clear
                </button>
                <button type="button" className="assistant-icon-btn" onClick={() => setIsOpen(false)}>
                  Close
                </button>
              </div>
            </header>

            <div className="assistant-thread" ref={threadRef}>
              {messages.length === 0 ? (
                <div className="assistant-empty-state">
                  <h4>Ask AI to help with discovery, drafts, or navigation.</h4>
                  <p>Try one of these to get started quickly.</p>
                  <div className="assistant-chip-row">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        className="assistant-chip"
                        onClick={() => handlePromptClick(suggestion.prompt)}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <article key={message.id} className={`assistant-message is-${message.role}`.trim()}>
                    <div className="assistant-message-meta">
                      <span>{message.role === 'assistant' ? 'Assistant' : 'You'}</span>
                      <time>{formatTimestamp(message.createdAt)}</time>
                    </div>
                    <div className="assistant-message-body">
                      <p>{message.text}</p>
                      {message.role === 'assistant' ? renderAssistantExtras(message) : null}
                    </div>
                  </article>
                ))
              )}

              {loading ? (
                <article className="assistant-message is-assistant">
                  <div className="assistant-message-meta">
                    <span>Assistant</span>
                    <time>Thinking</time>
                  </div>
                  <div className="assistant-message-body">
                    <div className="assistant-thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              ) : null}
            </div>

            <form
              className="assistant-compose"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage(input);
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(input);
                  }
                }}
                rows={2}
                placeholder="Ask AI to summarize, find posts, or draft something useful..."
                disabled={loading}
              />
              <div className="assistant-compose-row">
                <span>{loading ? 'AI is thinking...' : 'Enter to send, Shift+Enter for a new line.'}</span>
                <div className="assistant-compose-actions">
                  {loading ? (
                    <button type="button" className="assistant-action-link is-button" onClick={stopThinking}>
                      Stop
                    </button>
                  ) : null}
                  <button type="submit" className="assistant-action-link is-button is-primary" disabled={loading || !input.trim()}>
                    Send
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      <button type="button" className="assistant-trigger" onClick={() => setIsOpen((current) => !current)}>
        <span className="assistant-trigger-badge" aria-hidden="true">AI</span>
        <span className="assistant-trigger-copy">
          <span className="assistant-trigger-label">Ask AI</span>
          <span className="assistant-trigger-title">Open Assistant</span>
        </span>
      </button>
    </div>
  );
}
