const OpenAI = require('openai');

const SECTION_ENUM = [
  'frontend',
  'backend',
  'algorithms',
  'system-design',
  'ui-ux',
  'devops-cloud',
  'mobile',
  'testing-qa',
  'security',
  'sde-general',
  'ai-llm',
  'mle',
  'deep-learning',
  'data-engineering',
  'statistics',
  'analytics',
  'experimentation',
  'visualization',
  'ds-general',
  'announcements',
  'system-update'
];

const FORUM_DRAFT_SCHEMA = {
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
      maxItems: 4
    },
    content: {
      type: 'string',
      minLength: 40,
      maxLength: 12000
    },
    rationale: {
      type: 'string',
      minLength: 1,
      maxLength: 400
    }
  },
  required: ['title', 'section', 'tags', 'content', 'rationale']
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
  )].slice(0, 4);
}

function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function buildPrompt({ message, styleProfile, referencePosts, fallbackDraft, currentUserName }) {
  const referenceSummary = referencePosts.length > 0
    ? referencePosts.map((post, index) => (
      `${index + 1}. ${post.title}\nsection: ${post.section}\ntags: ${(post.tags || []).join(', ') || 'none'}\nexcerpt: ${truncateText(post.content, 700)}`
    )).join('\n\n')
    : 'No reference posts available.';

  const styleSummary = styleProfile
    ? JSON.stringify({
        summary: styleProfile.summary,
        sampleSize: styleProfile.sampleSize,
        avgWordCount: styleProfile.avgWordCount,
        avgTitleLength: styleProfile.avgTitleLength,
        preferredSections: styleProfile.preferredSections,
        commonTags: styleProfile.commonTags,
        tone: styleProfile.tone,
        structure: styleProfile.structure,
        openerStyle: styleProfile.openerStyle,
        closingStyle: styleProfile.closingStyle,
        titlePattern: styleProfile.titlePattern,
        recurringTerms: styleProfile.recurringTerms
      }, null, 2)
    : 'No style profile available.';

  return [
    `User request: ${String(message || '').trim()}`,
    currentUserName ? `Forum user: ${currentUserName}` : '',
    '',
    'User writing profile:',
    styleSummary,
    '',
    'Reference posts from the same user:',
    referenceSummary,
    '',
    'Fallback draft outline:',
    JSON.stringify(fallbackDraft, null, 2),
    '',
    'Instructions:',
    '- Write a forum post draft that sounds like the same user, not like a generic assistant.',
    '- Preserve the user’s usual tone, section preference, post length, and structure when the history clearly suggests them.',
    '- Use the fallback draft only as a safety rail, not as the final writing style.',
    '- Prefer concrete, experience-based writing over generic advice.',
    '- Return clean markdown in content.',
    '- Do not mention that an AI wrote the post.',
    '- Keep tags relevant and concise.',
    '- If the request is vague, make a reasonable assumption consistent with the user profile.'
  ].filter(Boolean).join('\n');
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

function normalizeDraftPayload(payload, fallbackDraft) {
  const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const title = String(raw?.title || fallbackDraft.title || '').trim();
  const content = String(raw?.content || fallbackDraft.content || '').trim();
  const section = SECTION_ENUM.includes(String(raw?.section || ''))
    ? String(raw.section)
    : fallbackDraft.section;
  const tags = normalizeTags(raw?.tags?.length ? raw.tags : fallbackDraft.tags || []);
  const rationale = String(raw?.rationale || '').trim();

  if (title.length < 4) {
    throw new Error('OpenAI draft title was too short.');
  }
  if (content.length < 40) {
    throw new Error('OpenAI draft content was too short.');
  }

  return {
    draft: {
      title: truncateText(title, 180),
      section,
      tags,
      content: truncateText(content, 12000)
    },
    rationale
  };
}

function createOpenAIDraftService({ apiKey, model }) {
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
    async createDraft({ message, styleProfile, referencePosts, fallbackDraft, currentUserName }) {
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
                text: 'You are drafting a forum post for a technical community. Produce a publishable post that matches the user writing profile and reference posts.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: buildPrompt({ message, styleProfile, referencePosts, fallbackDraft, currentUserName })
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'forum_post_draft',
            strict: true,
            schema: FORUM_DRAFT_SCHEMA
          }
        }
      });

      const parsed = normalizeDraftPayload(extractJsonString(response), fallbackDraft);
      return {
        ...parsed,
        provider: 'openai',
        model: trimmedModel
      };
    }
  };
}

module.exports = {
  SECTION_ENUM,
  createOpenAIDraftService
};
