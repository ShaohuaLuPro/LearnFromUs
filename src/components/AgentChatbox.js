import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const starterPrompts = [
  'find posts about mongodb',
  'show top authors',
  'draft a post about password reset',
  'find posts about analytics'
];

export default function AgentChatbox({ currentUser, onAgentChat, onCreatePost }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'agent',
      reply: 'Ask me to search related posts, surface active authors, or draft a post you can publish.',
      quickActions: ['search-posts', 'show-trending', 'draft-post']
    }
  ]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (nextMessage) => {
    const message = String(nextMessage || input).trim();
    if (!message || loading) {
      return;
    }

    setMessages((current) => [...current, { id: `${Date.now()}-user`, role: 'user', text: message }]);
    setInput('');
    setLoading(true);
    const result = await onAgentChat(message);
    setLoading(false);

    if (!result.ok) {
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-error`, role: 'agent', reply: result.message || 'Agent request failed.' }
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-agent`,
        role: 'agent',
        ...result.data
      }
    ]);
  };

  const publishDraft = async (draft) => {
    const result = await onCreatePost(draft);
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-publish`,
        role: 'agent',
        reply: result.ok
          ? 'Draft published. I refreshed the forum state, and you can open it from My Posts or Forum.'
          : result.message
      }
    ]);
    if (result.ok) {
      navigate('/forum');
    }
  };

  return (
    <div className={`agent-chatbox ${isOpen ? 'is-open' : ''}`}>
      {isOpen && (
        <section className="agent-chatbox-panel">
          <div className="agent-chatbox-header">
            <div>
              <p className="type-kicker mb-1">Agent</p>
              <h3 className="mb-0">Forum Assistant</h3>
            </div>
            <button type="button" className="forum-secondary-btn" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>

          <div className="agent-chatbox-prompts">
            {starterPrompts.map((prompt) => (
              <button key={prompt} type="button" className="section-chip" onClick={() => sendMessage(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="agent-chatbox-thread">
            {messages.map((message) => (
              <div key={message.id} className={`agent-chatbox-message is-${message.role}`}>
                {message.role === 'user' ? (
                  <p className="mb-0">{message.text}</p>
                ) : (
                  <>
                    <p className="mb-2">{message.reply}</p>

                    {message.posts?.length > 0 && (
                      <div className="agent-chatbox-card-grid">
                        {message.posts.map((post) => (
                          <Link key={post.id} to={`/forum/post/${post.id}`} className="agent-chatbox-card">
                            <strong>{post.title}</strong>
                            <span>{post.authorName}</span>
                            <span>{post.section}</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {message.authors?.length > 0 && (
                      <div className="agent-chatbox-card-grid">
                        {message.authors.map((author) => (
                          <div key={`${author.author_email}-${author.rank || author.author_name}`} className="agent-chatbox-card">
                            <strong>{author.author_name}</strong>
                            <span>{author.post_count} posts</span>
                            {author.score !== undefined && <span>score {author.score}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {message.draft && (
                      <div className="agent-chatbox-draft">
                        <strong>{message.draft.title}</strong>
                        <span>{message.draft.section}</span>
                        {message.draft.tags?.length > 0 && <span>#{message.draft.tags.join(' #')}</span>}
                        <pre>{message.draft.content}</pre>
                        <div className="forum-actions">
                          <button type="button" className="forum-secondary-btn" onClick={() => setInput(`find posts about ${message.draft.title}`)}>
                            Search Similar
                          </button>
                          {currentUser ? (
                            <button type="button" className="forum-primary-btn" onClick={() => publishDraft(message.draft)}>
                              Publish Draft
                            </button>
                          ) : (
                            <Link to="/login" className="forum-primary-btn text-decoration-none">
                              Login to Publish
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {loading && <p className="muted mb-0">Agent is thinking...</p>}
          </div>

          <form
            className="agent-chatbox-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
          >
            <textarea
              className="form-control forum-input"
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask to search posts, find active authors, or draft a publishable post."
            />
            <div className="forum-actions">
              <button type="submit" className="forum-primary-btn" disabled={loading}>
                Send
              </button>
            </div>
          </form>
        </section>
      )}

      <button type="button" className="agent-chatbox-trigger" onClick={() => setIsOpen((current) => !current)}>
        AI Agent
      </button>
    </div>
  );
}
