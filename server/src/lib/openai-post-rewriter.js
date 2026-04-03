const OpenAI = require('openai');
const { SECTION_ENUM, sanitizeDraftTitle, sanitizePublishableContent } = require('./openai-drafts');

const REWRITE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      minLength: 4,
      maxLength: 180
    },
    section: {
      type: 'string',
      enum: SECTION_ENUM
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 32
      },
      maxItems: 8
    },
    content: {
      type: 'string',
      minLength: 20,
      maxLength: 20000
    },
    summary: {
      type: 'string',
      minLength: 1,
      maxLength: 280
    }
  },
  required: ['title', 'section', 'tags', 'content', 'summary']
};

function normalizeTags(tags) {
  return [...new Set(
    (Array.isArray(tags) ? tags : [])
      .map((value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9+#.\- ]+/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, ''))
      .filter(Boolean)
  )].slice(0, 8);
}

function extractJsonString(response) {
  const outputText = String(response?.output_text || '').trim();
  if (outputText) {
    return outputText;
  }

  const outputs = Array.isArray(response?.output) ? response.output : [];
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === 'string' && block.text.trim()) {
        return block.text.trim();
      }
    }
  }

  throw new Error('OpenAI response did not include output text.');
}

function createOpenAIPostRewriter({ apiKey, model }) {
  const trimmedKey = String(apiKey || '').trim();
  const trimmedModel = String(model || 'gpt-5-mini').trim() || 'gpt-5-mini';
  const client = trimmedKey ? new OpenAI({ apiKey: trimmedKey }) : null;

  return {
    isEnabled() {
      return Boolean(client);
    },
    getModel() {
      return trimmedModel;
    },
    async rewritePost({ post, instruction, styleProfile, currentUserName }) {
      if (!client) {
        return null;
      }

      const response = await client.responses.create({
        model: trimmedModel,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are editing a forum post for a technical community.',
                  'Rewrite the post according to the user instruction while preserving factual meaning unless the instruction explicitly asks for structural changes.',
                  'Return a fully edited post draft, not commentary.',
                  'Title must be plain title text only with no prefixes, labels, quotes, or markdown.',
                  'Content must be publish-ready and must not talk to the requester or describe the rewrite process.'
                ].join('\n')
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  instruction: String(instruction || '').trim(),
                  currentUserName: currentUserName || '',
                  styleProfile: styleProfile || null,
                  post: {
                    title: post.title,
                    section: post.section,
                    tags: post.tags || [],
                    content: post.content
                  }
                }, null, 2)
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'forum_post_rewrite',
            strict: true,
            schema: REWRITE_SCHEMA
          }
        }
      });

      const parsed = JSON.parse(extractJsonString(response));
      const rewritten = {
        title: sanitizeDraftTitle(parsed.title, post.title),
        section: SECTION_ENUM.includes(String(parsed.section || '')) ? String(parsed.section) : post.section,
        tags: normalizeTags(parsed.tags?.length ? parsed.tags : post.tags || []),
        content: sanitizePublishableContent(parsed.content, post.content)
      };

      if (rewritten.title.length < 4) {
        throw new Error('Rewritten title was too short.');
      }
      if (rewritten.content.length < 20) {
        throw new Error('Rewritten content was too short.');
      }

      return {
        draft: rewritten,
        summary: String(parsed.summary || '').trim(),
        provider: 'openai',
        model: trimmedModel
      };
    }
  };
}

module.exports = {
  createOpenAIPostRewriter
};
