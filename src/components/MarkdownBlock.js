import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getExternalLinkProps } from '../lib/links';

export default function MarkdownBlock({ content, className = 'post-detail-content' }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
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
                  style={oneDark}
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
        {content || ''}
      </ReactMarkdown>
    </div>
  );
}
