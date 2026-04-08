import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { resolveMediaSource } from '../api';
import { getExternalLinkProps } from '../lib/links';

function normalizeMediaTokens(input) {
  return String(input || '').replace(
    /\bmedia:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    (token) => resolveMediaSource(token)
  );
}

export default function MarkdownBlock({ content, className = 'post-detail-content' }) {
  const normalizedContent = useMemo(() => normalizeMediaTokens(content), [content]);

  const transformUrl = (url, key) => {
    if (key === 'src') {
      return resolveMediaSource(url);
    }
    return url;
  };

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        urlTransform={transformUrl}
        components={{
          code({ inline, className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            if (inline) {
              return (
                <code className="post-inline-code" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <section className="post-code-block">
                {match?.[1] && <div className="post-code-label">{match[1]}</div>}
                <SyntaxHighlighter
                  style={oneLight}
                  language={match?.[1] || 'text'}
                  PreTag="div"
                  className="post-code-pre"
                  customStyle={{ margin: 0, background: 'transparent', padding: '1rem' }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </section>
            );
          },
          img({ src, alt, ...props }) {
            const resolvedSource = resolveMediaSource(src);
            if (!resolvedSource) {
              return null;
            }
            return (
              <img
                src={resolvedSource}
                alt={alt || ''}
                className="markdown-content-image"
                loading="lazy"
                {...props}
              />
            );
          },
          p({ children }) {
            return <p>{children}</p>;
          },
          a({ href, children, ...props }) {
            return (
              <a href={href} {...getExternalLinkProps(href)} {...props}>
                {children}
              </a>
            );
          }
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
